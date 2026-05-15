package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

type ContractRecord struct {
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	ABI       string    `json:"abi"`
	Network   string    `json:"network"`
	TxHash    string    `json:"txHash"`
	CreatedAt time.Time `json:"createdAt"`
}

func main() {
	var jsonPath, dsn string
	flag.StringVar(&jsonPath, "json", "Blockchain-backend/data/contracts.json", "path to contracts.json")
	flag.StringVar(&dsn, "dsn", os.Getenv("PG_DSN"), "postgres DSN")
	flag.Parse()
	if dsn == "" {
		log.Fatal("PG DSN required (flag -dsn or env PG_DSN)")
	}

	f, err := os.Open(jsonPath)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	var arr []ContractRecord
	if err := json.NewDecoder(f).Decode(&arr); err != nil {
		log.Fatal(err)
	}
	if len(arr) == 0 {
		log.Println("no records to import")
		return
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	// ensure table exists
	_, err = db.Exec(`CREATE TABLE IF NOT EXISTS contracts (
    address TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    abi TEXT NOT NULL,
    network TEXT,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`)
	if err != nil {
		log.Fatal(err)
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatal(err)
	}
	stmt, err := tx.Prepare(`INSERT INTO contracts (address, name, abi, network, tx_hash, created_at)
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (address) DO UPDATE SET name=EXCLUDED.name, abi=EXCLUDED.abi, network=EXCLUDED.network, tx_hash=EXCLUDED.tx_hash`)
	if err != nil {
		log.Fatal(err)
	}
	defer stmt.Close()
	var n int
	for _, r := range arr {
		if _, err := stmt.Exec(r.Address, r.Name, r.ABI, r.Network, r.TxHash, r.CreatedAt); err != nil {
			tx.Rollback()
			log.Fatal(err)
		}
		n++
	}
	if err := tx.Commit(); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("imported %d records\n", n)
}
