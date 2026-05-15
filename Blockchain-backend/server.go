package main

import (
	"net/http"
	"strings"
    "database/sql"

	"blockchain-backend/auth"
	"blockchain-backend/contracts"
)

type Server struct {
	store  contracts.ContractStore
	nonce  auth.NonceProvider
	secret string
	admins map[string]bool
    // 为简单起见，直接在 Server 上提供一个通用 SQL 执行入口（通过 PG_DSN）
}

func NewServer(store contracts.ContractStore, secret string, adminCSV string) *Server {
	s := &Server{
		store:  store,
		nonce:  auth.NewMemoryNonce(),
		secret: secret,
		admins: map[string]bool{},
	}
	if adminCSV != "" {
		for _, part := range strings.Split(adminCSV, ",") {
			addr := strings.ToLower(strings.TrimSpace(part))
			if addr != "" {
				s.admins[addr] = true
			}
		}
	}
	return s
}

func (s *Server) dbExec(query string, args ...interface{}) (sql.Result, error) {
    dsn := envOr("PG_DSN", "")
    db, err := sql.Open("postgres", dsn)
    if err != nil { return nil, err }
    defer db.Close()
    return db.Exec(query, args...)
}

func (s *Server) RegisterRoutes(mux *http.ServeMux) {
	s.registerAuthRoutes(mux)
    s.registerOrgRoutes(mux)
	s.registerContractRoutes(mux)
    s.registerCampaignRoutes(mux)
    s.registerRewardRoutes(mux)
    s.registerLeaderboardRoutes(mux)
    s.registerAnalyticsRoutes(mux)
	s.registerTemplateRoutes(mux)
	s.registerMiscRoutes(mux)
    s.registerPerfRoutes(mux)
}
