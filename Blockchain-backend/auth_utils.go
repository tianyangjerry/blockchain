package main

import (
	"fmt"
	"net/http"
	"strings"

	"blockchain-backend/auth"
)

func (s *Server) parseAuth(r *http.Request) (auth.Token, error) {
	h := r.Header.Get("Authorization")
	if h == "" {
		return auth.Token{}, fmt.Errorf("missing auth")
	}
	parts := strings.SplitN(h, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return auth.Token{}, fmt.Errorf("bad auth header")
	}
	return auth.ParseAndVerify(parts[1], s.secret)
}
