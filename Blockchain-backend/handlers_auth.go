package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"blockchain-backend/auth"
	"blockchain-backend/email"
	"blockchain-backend/users"
)

func (s *Server) registerAuthRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/auth/nonce", s.handleNonce)
	mux.HandleFunc("/api/auth/verify", s.handleVerify)
	mux.HandleFunc("/api/auth/register", s.handleRegister)
	mux.HandleFunc("/api/auth/email/send", s.handleEmailSend)
	mux.HandleFunc("/api/auth/email/verify", s.handleEmailVerify)
}

func (s *Server) handleNonce(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct {
		Address string `json:"address"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Address == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("address required"))
		return
	}
	n, err := s.nonce.New(strings.ToLower(body.Address))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"nonce": n})
}

func (s *Server) handleVerify(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct{ Address, Signature, Role, IsRegistration string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Address == "" || body.Signature == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("address, signature required"))
		return
	}
	nonce, ok := s.nonce.Get(strings.ToLower(body.Address))
	if !ok {
		writeError(w, http.StatusBadRequest, fmt.Errorf("nonce missing/expired"))
		return
	}
	if err := verifyPersonalSign(body.Address, "Login:"+nonce, body.Signature); err != nil {
		writeError(w, http.StatusUnauthorized, fmt.Errorf("invalid signature: %v", err))
		return
	}
	s.nonce.Consume(strings.ToLower(body.Address))
    userStore, err := users.NewStore(envOr("PG_DSN", ""))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
    role := "user"
    if s.admins[strings.ToLower(body.Address)] {
        role = "admin"
    } else {
        // 若机构已批准，则授予 org 角色
        if okOrg, _ := userStore.IsOrgApproved(strings.ToLower(body.Address)); okOrg {
            role = "org"
        }
    }
    // 非注册登录：普通用户需要已绑定；管理员放行（避免因 DB 异常导致无法登录后台）
    if body.IsRegistration != "true" && role != "admin" {
        okBound, err := userStore.IsAddressBound(strings.ToLower(body.Address))
        if err != nil {
            writeError(w, http.StatusInternalServerError, err)
            return
        }
        if !okBound {
            writeError(w, http.StatusForbidden, fmt.Errorf("address not registered"))
            return
        }
    }
	tok := auth.Token{Address: strings.ToLower(body.Address), Role: role, Expiry: time.Now().Add(24 * time.Hour)}
	jwt := auth.SignToken(tok, s.secret)
	writeJSON(w, http.StatusOK, map[string]string{"token": jwt})
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct{ Email, Address string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Address == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("email, address required"))
		return
	}
	userStore, err := users.NewStore(envOr("PG_DSN", ""))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if err := userStore.BindEmailToAddress(strings.ToLower(body.Email), strings.ToLower(body.Address)); err != nil {
		writeError(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "registered"})
}

func (s *Server) handleEmailSend(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct{ Email string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("email required"))
		return
	}
	userStore, err := users.NewStore(envOr("PG_DSN", ""))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	bound, err := userStore.IsEmailBound(body.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if bound {
		writeError(w, http.StatusConflict, fmt.Errorf("email already registered"))
		return
	}
	code, err := users.Generate4DigitCode()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if err := userStore.SaveCode(body.Email, code, time.Now().Add(10*time.Minute)); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	// SMTP or log fallback
	host := os.Getenv("SMTP_HOST")
	portStr := os.Getenv("SMTP_PORT")
	user := os.Getenv("SMTP_USER")
	pass := os.Getenv("SMTP_PASS")
	from := os.Getenv("SMTP_FROM")
	sent := false
	if host != "" && portStr != "" && from != "" {
		var port int
		fmt.Sscanf(portStr, "%d", &port)
		if err := email.SendSMTP(host, port, user, pass, from, []string{body.Email}, "Your Verification Code", fmt.Sprintf("Your code is %s", code)); err == nil {
			sent = true
		} else {
			log.Printf("smtp send failed: %v", err)
		}
	}
	if !sent {
		log.Printf("[DEV] send code %s to %s", code, body.Email)
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "sent"})
}

func (s *Server) handleEmailVerify(w http.ResponseWriter, r *http.Request) {
	enableCORS(w, r)
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var body struct{ Email, Code string }
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Email == "" || body.Code == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("email, code required"))
		return
	}
	userStore, err := users.NewStore(envOr("PG_DSN", ""))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	ok, err := userStore.VerifyCode(body.Email, body.Code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	if !ok {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid code"))
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "verified"})
}
