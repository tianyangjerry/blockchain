package users

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	_ "github.com/lib/pq"
	"time"
)

type Store struct {
	db *sql.DB
}

func NewStore(dsn string) (*Store, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
    // Limit connection usage to avoid exhausting Postgres max_connections
    db.SetMaxOpenConns(10)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *Store) migrate(ctx context.Context) error {
	// 基础表（若已存在则跳过创建，不会变更结构）
	if _, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS orgs (
  address TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,
  docs TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);
`); err != nil {
		return err
	}
	// 迁移：补齐 address 列（老表没有该列会导致索引创建失败）
	if _, err := s.db.ExecContext(ctx, `ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;`); err != nil {
		return err
	}
	// 唯一索引（忽略空值）
	_, err := s.db.ExecContext(ctx, `CREATE UNIQUE INDEX IF NOT EXISTS users_address_uindex ON users(address) WHERE address IS NOT NULL;`)
	return err
}

type Org struct {
    Address   string    `json:"address"`
    OrgName   string    `json:"orgName"`
    Docs      string    `json:"docs"`
    Status    string    `json:"status"`
    CreatedAt time.Time `json:"createdAt"`
    DecidedAt *time.Time `json:"decidedAt,omitempty"`
}

func (s *Store) ApplyOrg(address, orgName, docs string) error {
    if address == "" || orgName == "" { return fmt.Errorf("address, orgName required") }
    _, err := s.db.Exec(`INSERT INTO orgs(address, org_name, docs, status) VALUES($1,$2,$3,'pending')
ON CONFLICT(address) DO UPDATE SET org_name=EXCLUDED.org_name, docs=EXCLUDED.docs, status='pending', decided_at=NULL`, address, orgName, docs)
    return err
}

func (s *Store) SetOrgStatus(address, status string) error {
    if status != "approved" && status != "rejected" { return fmt.Errorf("invalid status") }
    _, err := s.db.Exec(`UPDATE orgs SET status=$1, decided_at=NOW() WHERE address=$2`, status, address)
    return err
}

func (s *Store) IsOrgApproved(address string) (bool, error) {
    var st string
    err := s.db.QueryRow(`SELECT status FROM orgs WHERE LOWER(address)=LOWER($1)`, address).Scan(&st)
    if err == sql.ErrNoRows { return false, nil }
    if err != nil { return false, err }
    return st == "approved", nil
}

func (s *Store) ListOrgApplications(status string) ([]Org, error) {
    var rows *sql.Rows
    var err error
    if status == "" {
        rows, err = s.db.Query(`SELECT address, org_name, docs, status, created_at, decided_at FROM orgs ORDER BY created_at DESC`)
    } else {
        rows, err = s.db.Query(`SELECT address, org_name, docs, status, created_at, decided_at FROM orgs WHERE status=$1 ORDER BY created_at DESC`, status)
    }
    if err != nil { return nil, err }
    defer rows.Close()
    var out []Org
    for rows.Next() {
        var o Org
        var decided sql.NullTime
        if err := rows.Scan(&o.Address, &o.OrgName, &o.Docs, &o.Status, &o.CreatedAt, &decided); err != nil { return nil, err }
        if decided.Valid { t := decided.Time; o.DecidedAt = &t }
        out = append(out, o)
    }
    return out, rows.Err()
}

func (s *Store) IsVerified(email string) (bool, error) {
	var v bool
	err := s.db.QueryRow(`SELECT verified FROM users WHERE email=$1`, email).Scan(&v)
	if err == sql.ErrNoRows {
		return false, nil
	}
	return v, err
}

func (s *Store) SaveCode(email, code string, expiresAt time.Time) error {
	_, err := s.db.Exec(`INSERT INTO email_codes(email, code, expires_at) VALUES($1,$2,$3)
    ON CONFLICT (email) DO UPDATE SET code=EXCLUDED.code, expires_at=EXCLUDED.expires_at`, email, code, expiresAt)
	return err
}

func (s *Store) VerifyCode(email, code string) (bool, error) {
	var dbCode string
	var exp time.Time
	err := s.db.QueryRow(`SELECT code, expires_at FROM email_codes WHERE email=$1`, email).Scan(&dbCode, &exp)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if time.Now().After(exp) {
		return false, nil
	}
	if dbCode != code {
		return false, nil
	}
	// 只删除验证码，不立即标记邮箱为已验证
	// 邮箱验证状态将在钱包绑定成功时一起写入
	_, _ = s.db.Exec(`DELETE FROM email_codes WHERE email=$1`, email)
	return true, nil
}

func (s *Store) BindEmailToAddress(email string, address string) error {
	// 检查邮箱是否已经绑定到其他地址
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	// 检查邮箱是否已经存在且已绑定
	var existingAddress string
	err = tx.QueryRow(`SELECT address FROM users WHERE email=$1`, email).Scan(&existingAddress)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if existingAddress != "" {
		return fmt.Errorf("email already bound to another address")
	}

	// 检查地址是否已经绑定到其他邮箱
	var existingEmail string
	err = tx.QueryRow(`SELECT email FROM users WHERE address=$1`, address).Scan(&existingEmail)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	if existingEmail != "" {
		return fmt.Errorf("address already bound to another email")
	}

	// 插入或更新用户记录，同时设置verified=TRUE和address
	_, err = tx.Exec(`INSERT INTO users(email, verified, address) VALUES($1, TRUE, $2)
		ON CONFLICT (email) DO UPDATE SET verified=TRUE, address=$2`, email, address)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) IsAddressBound(address string) (bool, error) {
	var email string
	err := s.db.QueryRow(`SELECT email FROM users WHERE address=$1 AND verified=TRUE`, address).Scan(&email)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return email != "", nil
}

// GetEmailByAddress returns the bound email for an address if verified.
func (s *Store) GetEmailByAddress(address string) (string, bool, error) {
    var email string
    err := s.db.QueryRow(`SELECT email FROM users WHERE LOWER(address)=LOWER($1) AND verified=TRUE`, address).Scan(&email)
    if err == sql.ErrNoRows {
        return "", false, nil
    }
    if err != nil {
        return "", false, err
    }
    return email, true, nil
}

func (s *Store) IsEmailBound(email string) (bool, error) {
	var address string
	err := s.db.QueryRow(`SELECT address FROM users WHERE email=$1 AND address IS NOT NULL`, email).Scan(&address)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return address != "", nil
}

func Generate4DigitCode() (string, error) {
	// 1000-9999
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	n := (int(b[0])<<8|int(b[1]))%9000 + 1000
	return fmt.Sprintf("%04d", n), nil
}
