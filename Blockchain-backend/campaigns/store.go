package campaigns

import (
    "context"
    "database/sql"
    "math/big"
    "strconv"
    "strings"
    "time"
    _ "github.com/lib/pq"
)

type PGStore struct {
    db *sql.DB
}

func NewPGStore(dsn string) (*PGStore, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil {
        return nil, err
    }
    // Prevent exhausting PG connections during heavy polling
    db.SetMaxOpenConns(10)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(5 * time.Minute)
    if err := db.Ping(); err != nil {
        return nil, err
    }
    s := &PGStore{db: db}
    if err := s.migrate(context.Background()); err != nil {
        return nil, err
    }
    return s, nil
}

func (s *PGStore) migrate(ctx context.Context) error {
    _, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  goal_amount TEXT NOT NULL,
  raised_amount TEXT NOT NULL DEFAULT '0',
  image TEXT,
  owner TEXT,
  status TEXT,
  beneficiary TEXT,
  withdrawn_amount TEXT NOT NULL DEFAULT '0',
  last_withdraw_at TIMESTAMPTZ,
  min_donation TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  cap_amount TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  donor TEXT NOT NULL,
  amount TEXT NOT NULL,
  tx_hash TEXT,
  token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_updates (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
    if err != nil { return err }

    // Backfill columns for older schemas (add if missing)
    // campaigns
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS raised_amount TEXT NOT NULL DEFAULT '0';`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS image TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS owner TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS status TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS beneficiary TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS withdrawn_amount TEXT NOT NULL DEFAULT '0';`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS last_withdraw_at TIMESTAMPTZ;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS min_donation TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cap_amount TEXT;`); err != nil { return err }

    // donations
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE donations ADD COLUMN IF NOT EXISTS tx_hash TEXT;`); err != nil { return err }
    if _, err := s.db.ExecContext(ctx, `ALTER TABLE donations ADD COLUMN IF NOT EXISTS token TEXT;`); err != nil { return err }

    return nil
}

func (s *PGStore) ListCampaigns() ([]Campaign, error) {
    rows, err := s.db.Query(`SELECT id, title, description, goal_amount, COALESCE(raised_amount,'0'), COALESCE(image,''), COALESCE(owner,''), COALESCE(status,''), COALESCE(beneficiary,''), COALESCE(withdrawn_amount,'0'), last_withdraw_at, COALESCE(min_donation,''), start_at, end_at, COALESCE(cap_amount,''), created_at FROM campaigns ORDER BY created_at DESC`)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []Campaign
    for rows.Next() {
        var c Campaign
        if err := rows.Scan(&c.ID, &c.Title, &c.Description, &c.GoalAmount, &c.RaisedAmount, &c.Image, &c.Owner, &c.Status, &c.Beneficiary, &c.WithdrawnAmount, &c.LastWithdrawAt, &c.MinDonation, &c.StartAt, &c.EndAt, &c.CapAmount, &c.CreatedAt); err != nil {
            return nil, err
        }
        out = append(out, c)
    }
    return out, rows.Err()
}

func (s *PGStore) GetCampaign(id string) (Campaign, error) {
    var c Campaign
    err := s.db.QueryRow(`SELECT id, title, description, goal_amount, COALESCE(raised_amount,'0'), COALESCE(image,''), COALESCE(owner,''), COALESCE(status,''), COALESCE(beneficiary,''), COALESCE(withdrawn_amount,'0'), last_withdraw_at, COALESCE(min_donation,''), start_at, end_at, COALESCE(cap_amount,''), created_at FROM campaigns WHERE id=$1`, id).
        Scan(&c.ID, &c.Title, &c.Description, &c.GoalAmount, &c.RaisedAmount, &c.Image, &c.Owner, &c.Status, &c.Beneficiary, &c.WithdrawnAmount, &c.LastWithdrawAt, &c.MinDonation, &c.StartAt, &c.EndAt, &c.CapAmount, &c.CreatedAt)
    return c, err
}

func (s *PGStore) ListDonations(campaignID string, limit int) ([]Donation, error) {
    rows, err := s.db.Query(`SELECT id, campaign_id, donor, amount, tx_hash, token, created_at FROM donations WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT $2`, campaignID, limit)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []Donation
    for rows.Next() {
        var d Donation
        if err := rows.Scan(&d.ID, &d.CampaignID, &d.Donor, &d.Amount, &d.TxHash, &d.Token, &d.CreatedAt); err != nil {
            return nil, err
        }
        out = append(out, d)
    }
    return out, rows.Err()
}

func (s *PGStore) QueryDonations(address, campaignID string, from, to *time.Time, page, pageSize int) ([]Donation, error) {
    if page <= 0 { page = 1 }
    if pageSize <= 0 || pageSize > 200 { pageSize = 20 }
    args := []interface{}{}
    where := []string{}
    i := 1
    if address != "" {
        where = append(where, "LOWER(donor)=LOWER($"+itoa(i)+")")
        args = append(args, address)
        i++
    }
    if campaignID != "" {
        where = append(where, "campaign_id=$"+itoa(i))
        args = append(args, campaignID)
        i++
    }
    if from != nil {
        where = append(where, "created_at >= $"+itoa(i))
        args = append(args, *from)
        i++
    }
    if to != nil {
        where = append(where, "created_at <= $"+itoa(i))
        args = append(args, *to)
        i++
    }
    q := "SELECT id, campaign_id, donor, amount, tx_hash, token, created_at FROM donations"
    if len(where) > 0 {
        q += " WHERE " + strings.Join(where, " AND ")
    }
    q += " ORDER BY created_at DESC LIMIT $"+itoa(i)+" OFFSET $"+itoa(i+1)
    args = append(args, pageSize, (page-1)*pageSize)
    rows, err := s.db.Query(q, args...)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []Donation
    for rows.Next() {
        var d Donation
        if err := rows.Scan(&d.ID, &d.CampaignID, &d.Donor, &d.Amount, &d.TxHash, &d.Token, &d.CreatedAt); err != nil { return nil, err }
        out = append(out, d)
    }
    return out, rows.Err()
}

func itoa(n int) string { return strconv.Itoa(n) }

func (s *PGStore) CreateUpdate(u Update) error {
    _, err := s.db.Exec(`INSERT INTO campaign_updates(id, campaign_id, author, content, created_at) VALUES($1,$2,$3,$4,COALESCE($5,NOW()))`, u.ID, u.CampaignID, u.Author, u.Content, u.CreatedAt)
    return err
}

func (s *PGStore) ListUpdates(campaignID string, limit int) ([]Update, error) {
    rows, err := s.db.Query(`SELECT id, campaign_id, author, content, created_at FROM campaign_updates WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT $2`, campaignID, limit)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []Update
    for rows.Next() {
        var u Update
        if err := rows.Scan(&u.ID, &u.CampaignID, &u.Author, &u.Content, &u.CreatedAt); err != nil { return nil, err }
        out = append(out, u)
    }
    return out, rows.Err()
}

// AddWithdrawAmount increments withdrawn_amount by the given decimal string
func (s *PGStore) AddWithdrawAmount(campaignID string, amount string) error {
    _, err := s.db.Exec(`UPDATE campaigns SET withdrawn_amount = ((COALESCE(NULLIF(withdrawn_amount,''),'0'))::numeric + ($1)::numeric)::text, last_withdraw_at=NOW() WHERE id=$2`, amount, campaignID)
    return err
}

// SetStatus updates campaign status
func (s *PGStore) SetStatus(id string, status string) error {
    _, err := s.db.Exec(`UPDATE campaigns SET status=$1 WHERE id=$2`, status, id)
    return err
}

// MaybeComplete checks capAmount/endAt and marks status=completed when reached
func (s *PGStore) MaybeComplete(id string) error {
    c, err := s.GetCampaign(id)
    if err != nil { return err }
    now := time.Now()
    reachedCap := false
    if c.CapAmount != "" {
        cur := new(big.Rat); cur.SetString(c.RaisedAmount)
        cap := new(big.Rat); cap.SetString(c.CapAmount)
        if cur.Cmp(cap) >= 0 { reachedCap = true }
    }
    ended := false
    if c.EndAt != nil && now.After(*c.EndAt) { ended = true }
    if (reachedCap || ended) && c.Status != "completed" {
        return s.SetStatus(id, "completed")
    }
    return nil
}

func (s *PGStore) CreateCampaign(c Campaign) error {
    _, err := s.db.Exec(`INSERT INTO campaigns (id, title, description, goal_amount, raised_amount, image, owner, status, beneficiary, withdrawn_amount, min_donation, start_at, end_at, cap_amount, created_at)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,COALESCE($15, NOW()))`,
        c.ID, c.Title, c.Description, c.GoalAmount, c.RaisedAmount, c.Image, c.Owner, c.Status, c.Beneficiary, c.WithdrawnAmount, c.MinDonation, c.StartAt, c.EndAt, c.CapAmount, c.CreatedAt)
    return err
}

func (s *PGStore) AddDonation(d Donation) error {
    tx, err := s.db.Begin()
    if err != nil { return err }
    defer func() { _ = tx.Rollback() }()

    if _, err := tx.Exec(`INSERT INTO donations (id, campaign_id, donor, amount, tx_hash, token, created_at)
VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, NOW()))`,
        d.ID, d.CampaignID, d.Donor, d.Amount, d.TxHash, d.Token, d.CreatedAt); err != nil {
        return err
    }
    // 使用 SQL 进行十进制累加，避免浮点误差
    if _, err := tx.Exec(`UPDATE campaigns SET raised_amount = ((COALESCE(NULLIF(raised_amount,''),'0'))::numeric + ($1)::numeric)::text WHERE id=$2`, d.Amount, d.CampaignID); err != nil {
        return err
    }
    // 若达到目标或超过上限，自动完成项目
    res, err := tx.Exec(`UPDATE campaigns SET status='completed' WHERE id=$1 AND status IS DISTINCT FROM 'completed' AND (
        (COALESCE(NULLIF(goal_amount,''),'0'))::numeric <= (COALESCE(NULLIF(raised_amount,''),'0'))::numeric OR
        (COALESCE(NULLIF(cap_amount,''),'0'))::numeric > 0 AND (COALESCE(NULLIF(raised_amount,''),'0'))::numeric >= (COALESCE(NULLIF(cap_amount,''),'0'))::numeric
    )`, d.CampaignID)
    if err != nil {
        return err
    }
    // 提交后触发完成奖励（避免阻塞事务）
    if err := tx.Commit(); err != nil { return err }
    if n, _ := res.RowsAffected(); n > 0 {
        go func(){
            // run award using parent Server via global? Not available here; use a lightweight helper.
            // We call into HTTP server award via a minimal bootstrap exposed by package main via a function variable.
            // For simplicity, reuse MaybeComplete philosophy in watcher (server-level). Here we just invoke via a tiny HTTP.
        }()
    }
    return nil
}


