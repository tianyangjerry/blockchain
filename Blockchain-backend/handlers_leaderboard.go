package main

import (
    "database/sql"
    "encoding/json"
    "math/big"
    "net/http"
    "strings"

    _ "github.com/lib/pq"
    "blockchain-backend/rewards"
)

type leaderboardEntry struct {
    Donor      string `json:"donor"`
    TotalETH   string `json:"totalEth"`
    TotalPoint string `json:"totalPoints"`
}

func (s *Server) registerLeaderboardRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/rewards/leaderboard", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()

        // 读取奖励配置
        cfg, err := s.getRewardConfigInternal()
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        ppe := new(big.Rat)
        if _, ok := ppe.SetString(cfg.PointPerETH); !ok { ppe = big.NewRat(100, 1) }

        lim := 100
        rows, err := db.Query(`SELECT donor, SUM((amount)::numeric)::text AS total_eth FROM donations GROUP BY donor ORDER BY SUM((amount)::numeric) DESC LIMIT $1`, lim)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer rows.Close()

        var out []leaderboardEntry
        for rows.Next() {
            var donor, totalEthStr string
            if err := rows.Scan(&donor, &totalEthStr); err != nil { writeError(w, http.StatusInternalServerError, err); return }
            te := new(big.Rat)
            if _, ok := te.SetString(totalEthStr); !ok { te = big.NewRat(0,1) }
            pts := new(big.Rat).Mul(te, ppe)
            out = append(out, leaderboardEntry{Donor: donor, TotalETH: te.FloatString(6), TotalPoint: pts.FloatString(0)})
        }
        writeJSON(w, http.StatusOK, out)
    })

    mux.HandleFunc("/api/rewards/badges/", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/rewards/badges/"), "/")
        if len(parts) < 1 || parts[0] == "" { w.WriteHeader(http.StatusBadRequest); return }
        address := strings.ToLower(parts[0])

        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()

        var totalEthStr string
        if err := db.QueryRow(`SELECT COALESCE(SUM((amount)::numeric),0)::text FROM donations WHERE LOWER(donor)=LOWER($1)`, address).Scan(&totalEthStr); err != nil {
            writeError(w, http.StatusInternalServerError, err); return
        }

        cfg, err := s.getRewardConfigInternal()
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }

        // 解析阈值 JSON
        var thresholds map[string]string
        _ = json.Unmarshal([]byte(cfg.NFTThresholdsJSON), &thresholds)
        te := new(big.Rat)
        if _, ok := te.SetString(totalEthStr); !ok { te = big.NewRat(0,1) }

        ppe := new(big.Rat)
        if _, ok := ppe.SetString(cfg.PointPerETH); !ok { ppe = big.NewRat(100,1) }
        pts := new(big.Rat).Mul(te, ppe)

        badges := make([]string, 0)
        for name, v := range thresholds {
            need := new(big.Rat)
            if _, ok := need.SetString(v); ok {
                if te.Cmp(need) >= 0 {
                    badges = append(badges, name)
                }
            }
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
            "address": address,
            "totalEth": te.FloatString(6),
            "totalPoints": pts.FloatString(0),
            "badges": badges,
        })
    })
}

// 供内部复用：拉取奖励配置（若不存在则使用默认）
func (s *Server) getRewardConfigInternal() (cfg struct{ PointPerETH, NFTThresholdsJSON, DailyCapPerAddress string; CooldownSeconds int }, err error) {
    store, e := rewards.NewPGStore(envOr("PG_DSN", ""))
    if e != nil { err = e; return }
    c, e := store.GetConfig(rewardsConfigID)
    if e != nil {
        // 若不存在，返回默认
        cfg.PointPerETH = "100"
        cfg.NFTThresholdsJSON = `{"bronze":"0.1","silver":"1","gold":"5"}`
        cfg.DailyCapPerAddress = "1000"
        cfg.CooldownSeconds = 60
        return
    }
    cfg.PointPerETH = c.PointPerETH
    cfg.NFTThresholdsJSON = c.NFTThresholdsJSON
    cfg.DailyCapPerAddress = c.DailyCapPerAddress
    cfg.CooldownSeconds = c.CooldownSeconds
    return
}


