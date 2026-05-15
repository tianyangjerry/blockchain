package main

import (
    "encoding/json"
    "net/http"
    "strings"

    "blockchain-backend/users"
)

func (s *Server) registerOrgRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/org/apply", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodPost { w.WriteHeader(http.StatusMethodNotAllowed); return }
        // 需要登录（任意用户），从 token 取地址
        t, err := s.parseAuth(r)
        if err != nil { writeError(w, http.StatusUnauthorized, err); return }
        var body struct{ OrgName, Docs string }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.OrgName == "" { writeError(w, http.StatusBadRequest, err); return }
        store, err := users.NewStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        if err := store.ApplyOrg(strings.ToLower(t.Address), body.OrgName, body.Docs); err != nil { writeError(w, http.StatusBadRequest, err); return }
        writeJSON(w, http.StatusOK, map[string]string{"status":"applied"})
    })

    mux.HandleFunc("/api/org/list", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        if !s.requireAdmin(w, r) { return }
        status := r.URL.Query().Get("status")
        store, err := users.NewStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        out, err := store.ListOrgApplications(status)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        writeJSON(w, http.StatusOK, out)
    })

    mux.HandleFunc("/api/org/approve", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodPost { w.WriteHeader(http.StatusMethodNotAllowed); return }
        if !s.requireAdmin(w, r) { return }
        var body struct{ Address, Status string }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Address == "" { writeError(w, http.StatusBadRequest, err); return }
        if body.Status == "" { body.Status = "approved" }
        store, err := users.NewStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        if err := store.SetOrgStatus(strings.ToLower(body.Address), body.Status); err != nil { writeError(w, http.StatusBadRequest, err); return }
        writeJSON(w, http.StatusOK, map[string]string{"status": body.Status})
    })
}


