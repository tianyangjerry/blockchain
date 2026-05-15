package main

import (
    "context"
    "database/sql"
    _ "github.com/lib/pq"
)

type WatcherCursorStore struct{ db *sql.DB }

func NewWatcherCursorStore(dsn string) (*WatcherCursorStore, error) {
    db, err := sql.Open("postgres", dsn)
    if err != nil { return nil, err }
    if err := db.Ping(); err != nil { return nil, err }
    s := &WatcherCursorStore{db: db}
    if err := s.migrate(context.Background()); err != nil { return nil, err }
    return s, nil
}

func (s *WatcherCursorStore) migrate(ctx context.Context) error {
    _, err := s.db.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS watcher_cursors (
  key TEXT PRIMARY KEY,
  last_block BIGINT NOT NULL DEFAULT 0
);
`)
    return err
}

func (s *WatcherCursorStore) Get(key string) (int64, error) {
    var n int64
    err := s.db.QueryRow(`SELECT last_block FROM watcher_cursors WHERE key=$1`, key).Scan(&n)
    if err == sql.ErrNoRows { return 0, nil }
    return n, err
}

func (s *WatcherCursorStore) Set(key string, block int64) error {
    _, err := s.db.Exec(`INSERT INTO watcher_cursors(key, last_block) VALUES($1,$2)
ON CONFLICT(key) DO UPDATE SET last_block=EXCLUDED.last_block`, key, block)
    return err
}


