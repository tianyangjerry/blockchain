package main

import (
	"log"
	"net/http"
	"os"

	"blockchain-backend/contracts"
)

func main() {
	dsn := envOr("PG_DSN", "")
	if dsn == "" {
		log.Fatal("PG_DSN required")
	}
	storeIface, err := contracts.NewPGStore(dsn)
	if err != nil {
		log.Fatalf("pg store init error: %v", err)
	}

	s := NewServer(storeIface, envOr("AUTH_SECRET", "dev-secret"), os.Getenv("ADMIN_ADDRESSES"))
	mux := http.NewServeMux()
	s.RegisterRoutes(mux)

	// 启动捐赠事件监听（如配置了 DONATION_CONTRACT_ADDRESS 与 RPC_URL）
	s.StartDonationWatcher()

	addr := envOr("ADDR", ":8080")
	log.Printf("listening on %s", addr)
	if err := http.ListenAndServe(addr, withCORSMiddleware(mux)); err != nil {
		log.Fatal(err)
	}
}
