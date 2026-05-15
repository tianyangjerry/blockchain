package rewards

import (
    "context"
    "database/sql"
    "time"
    _ "github.com/lib/pq"
)

type PGStore struct { db *sql.DB }

func NewPGStore(dsn string) (*PGStore, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil { return nil, err }
    if err := db.Ping(); err != nil { return nil, err }
    s := &PGStore{db: db}
    if err := s.migrate(context.Background()); err != nil { return nil, err }
    return s, nil
}

func (s *PGStore) migrate(ctx context.Context) error {
    _, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS rewards_config (
  id TEXT PRIMARY KEY,
  point_per_eth TEXT NOT NULL,
  nft_thresholds_json TEXT NOT NULL,
  daily_cap_per_address TEXT NOT NULL,
  cooldown_seconds INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reward_points (
  address TEXT PRIMARY KEY,
  points TEXT NOT NULL DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS reward_badges (
  address TEXT NOT NULL,
  badge TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tx_hash TEXT,
  PRIMARY KEY(address, badge)
);

CREATE TABLE IF NOT EXISTS reward_daily (
  address TEXT NOT NULL,
  day DATE NOT NULL,
  points TEXT NOT NULL DEFAULT '0',
  last_at TIMESTAMPTZ,
  PRIMARY KEY(address, day)
);
`)
    return err
}

func (s *PGStore) GetConfig(id string) (Config, error) {
    var c Config
    err := s.db.QueryRow(`SELECT id, point_per_eth, nft_thresholds_json, daily_cap_per_address, cooldown_seconds, updated_at FROM rewards_config WHERE id=$1`, id).
        Scan(&c.ID, &c.PointPerETH, &c.NFTThresholdsJSON, &c.DailyCapPerAddress, &c.CooldownSeconds, &c.UpdatedAt)
    return c, err
}

func (s *PGStore) UpsertConfig(c Config) error {
    _, err := s.db.Exec(`INSERT INTO rewards_config (id, point_per_eth, nft_thresholds_json, daily_cap_per_address, cooldown_seconds, updated_at)
VALUES ($1,$2,$3,$4,$5,NOW())
ON CONFLICT (id) DO UPDATE SET point_per_eth=EXCLUDED.point_per_eth, nft_thresholds_json=EXCLUDED.nft_thresholds_json, daily_cap_per_address=EXCLUDED.daily_cap_per_address, cooldown_seconds=EXCLUDED.cooldown_seconds, updated_at=NOW()`,
        c.ID, c.PointPerETH, c.NFTThresholdsJSON, c.DailyCapPerAddress, c.CooldownSeconds)
    return err
}

// 增加积分（以十进制字符串计算并累加）
func (s *PGStore) AddPoints(address, add string) error {
    tx, err := s.db.Begin()
    if err != nil { return err }
    defer func(){ _ = tx.Rollback() }()
    if _, err := tx.Exec(`INSERT INTO reward_points (address, points) VALUES ($1, '0') ON CONFLICT (address) DO NOTHING`, address); err != nil { return err }
    if _, err := tx.Exec(`UPDATE reward_points SET points = ((COALESCE(NULLIF(points,''),'0'))::numeric + ($1)::numeric)::text WHERE address=$2`, add, address); err != nil { return err }
    return tx.Commit()
}

func (s *PGStore) GetPoints(address string) (string, error) {
    var p string
    err := s.db.QueryRow(`SELECT COALESCE(points,'0') FROM reward_points WHERE address=$1`, address).Scan(&p)
    if err == sql.ErrNoRows { return "0", nil }
    return p, err
}

func (s *PGStore) HasBadge(address, badge string) (bool, error) {
    var exists bool
    err := s.db.QueryRow(`SELECT EXISTS(SELECT 1 FROM reward_badges WHERE address=$1 AND badge=$2)`, address, badge).Scan(&exists)
    return exists, err
}

func (s *PGStore) IssueBadge(address, badge, txHash string) error {
    _, err := s.db.Exec(`INSERT INTO reward_badges (address, badge, tx_hash) VALUES ($1,$2,$3) ON CONFLICT (address,badge) DO NOTHING`, address, badge, txHash)
    return err
}

func (s *PGStore) ListBadges(address string) ([]string, error) {
    rows, err := s.db.Query(`SELECT badge FROM reward_badges WHERE address=$1 ORDER BY issued_at ASC`, address)
    if err != nil { return nil, err }
    defer rows.Close()
    var out []string
    for rows.Next() {
        var b string
        if err := rows.Scan(&b); err != nil { return nil, err }
        out = append(out, b)
    }
    return out, rows.Err()
}

// Daily helpers for anti-abuse
func (s *PGStore) GetDaily(address string, day time.Time) (points string, lastAt sql.NullTime, err error) {
    err = s.db.QueryRow(`SELECT points, last_at FROM reward_daily WHERE address=$1 AND day=$2`, address, day.Format("2006-01-02")).Scan(&points, &lastAt)
    if err == sql.ErrNoRows {
        return "0", sql.NullTime{}, nil
    }
    return
}

func (s *PGStore) AddDaily(address string, day time.Time, add string, now time.Time) error {
    _, err := s.db.Exec(`INSERT INTO reward_daily(address, day, points, last_at) VALUES ($1,$2,$3,$4)
ON CONFLICT(address, day) DO UPDATE SET points=((COALESCE(NULLIF(reward_daily.points,''),'0'))::numeric + ($3)::numeric)::text, last_at=EXCLUDED.last_at`, address, day.Format("2006-01-02"), add, now)
    return err
}


