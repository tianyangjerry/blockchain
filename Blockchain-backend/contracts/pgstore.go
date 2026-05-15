package contracts

import (
	"context"
	"database/sql"
	"errors"
	_ "github.com/lib/pq"
	"time"
)

type PGStore struct {
	db *sql.DB
}

func NewPGStore(dsn string) (*PGStore, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
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
CREATE TABLE IF NOT EXISTS contracts (
  address TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  abi TEXT NOT NULL,
  network TEXT,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`)
	return err
}

func (s *PGStore) List() ([]ContractRecord, error) {
	rows, err := s.db.Query(`SELECT name, address, abi, network, tx_hash, created_at FROM contracts ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ContractRecord
	for rows.Next() {
		var r ContractRecord
		if err := rows.Scan(&r.Name, &r.Address, &r.ABI, &r.Network, &r.TxHash, &r.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *PGStore) Get(address string) (ContractRecord, bool) {
	var r ContractRecord
	err := s.db.QueryRow(`SELECT name, address, abi, network, tx_hash, created_at FROM contracts WHERE address=$1`, address).Scan(&r.Name, &r.Address, &r.ABI, &r.Network, &r.TxHash, &r.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ContractRecord{}, false
	}
	if err != nil {
		return ContractRecord{}, false
	}
	return r, true
}

func (s *PGStore) Put(r ContractRecord) error {
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now()
	}
	_, err := s.db.Exec(`INSERT INTO contracts (address, name, abi, network, tx_hash, created_at) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (address) DO UPDATE SET name=EXCLUDED.name, abi=EXCLUDED.abi, network=EXCLUDED.network, tx_hash=EXCLUDED.tx_hash`,
		r.Address, r.Name, r.ABI, r.Network, r.TxHash, r.CreatedAt)
	return err
}
