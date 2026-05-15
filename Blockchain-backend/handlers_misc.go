package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "math/big"
    "net/http"
    "os"

    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/ethclient"

    "blockchain-backend/email"
)

func (s *Server) registerMiscRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

    // Runtime config for frontend: expose selected envs for client-side runtime usage
    mux.HandleFunc("/api/config", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        writeJSON(w, http.StatusOK, map[string]string{
            "donationContractAddress": os.Getenv("DONATION_CONTRACT_ADDRESS"),
            "rpcUrl": os.Getenv("RPC_URL"),
            "donationReceiver": os.Getenv("NEXT_PUBLIC_DONATION_RECEIVER"),
        })
    })

    mux.HandleFunc("/api/email/status", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        host := os.Getenv("SMTP_HOST")
        port := os.Getenv("SMTP_PORT")
        from := os.Getenv("SMTP_FROM")
        status := "disabled"
        if host != "" && port != "" && from != "" { status = "enabled" }
        writeJSON(w, http.StatusOK, map[string]string{"status": status})
    })

    mux.HandleFunc("/api/email/test", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodPost { w.WriteHeader(http.StatusMethodNotAllowed); return }
        if !s.requireAdmin(w, r) { return }
        var body struct{ To, Subject, Body string }
        if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.To == "" {
            writeError(w, http.StatusBadRequest, fmt.Errorf("to required"))
            return
        }
        host := os.Getenv("SMTP_HOST")
        portStr := os.Getenv("SMTP_PORT")
        user := os.Getenv("SMTP_USER")
        pass := os.Getenv("SMTP_PASS")
        from := os.Getenv("SMTP_FROM")
        if host == "" || portStr == "" || from == "" { writeError(w, http.StatusBadRequest, fmt.Errorf("smtp not configured")); return }
        var port int
        fmt.Sscanf(portStr, "%d", &port)
        if body.Subject == "" { body.Subject = "SMTP 测试" }
        if body.Body == "" { body.Body = "这是一封测试邮件" }
        if err := email.SendSMTP(host, port, user, pass, from, []string{body.To}, body.Subject, body.Body); err != nil {
            writeError(w, http.StatusBadRequest, err)
            return
        }
        writeJSON(w, http.StatusOK, map[string]string{"status":"sent"})
    })
}

// --- Analytics ---
// 简化版本：聚合 donations 与 campaigns 的统计数据
type AnalyticsSummary struct {
    TotalAmount string `json:"totalAmount"`
    TotalDonations int `json:"totalDonations"`
    TotalCampaigns int `json:"totalCampaigns"`
    ActiveCampaigns int `json:"activeCampaigns"`
}

func (s *Server) registerAnalyticsRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/analytics/summary", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()
        var totalAmount string
        _ = db.QueryRow(`SELECT COALESCE(SUM((amount)::numeric),0)::text FROM donations`).Scan(&totalAmount)
        var totalDonations int
        _ = db.QueryRow(`SELECT COUNT(*) FROM donations`).Scan(&totalDonations)
        var totalCampaigns int
        _ = db.QueryRow(`SELECT COUNT(*) FROM campaigns`).Scan(&totalCampaigns)
        var active int
        _ = db.QueryRow(`SELECT COUNT(*) FROM campaigns WHERE status IS DISTINCT FROM 'completed'`).Scan(&active)
        writeJSON(w, http.StatusOK, AnalyticsSummary{TotalAmount: totalAmount, TotalDonations: totalDonations, TotalCampaigns: totalCampaigns, ActiveCampaigns: active})
    })

    mux.HandleFunc("/api/analytics/daily", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        days := 30
        if v := r.URL.Query().Get("days"); v != "" {
            var tmp int; fmt.Sscanf(v, "%d", &tmp); if tmp > 0 && tmp <= 365 { days = tmp }
        }
        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()
        rows, err := db.Query(`SELECT to_char(created_at::date,'YYYY-MM-DD') d, COALESCE(SUM((amount)::numeric),0)::text amt, COUNT(*) cnt
FROM donations
WHERE created_at >= NOW() - INTERVAL '` + fmt.Sprintf("%d", days) + ` days'
GROUP BY d ORDER BY d ASC`)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer rows.Close()
        type row struct{ Date string `json:"date"`; Amount string `json:"amount"`; Count int `json:"count"` }
        var out []row
        for rows.Next() { var r1 row; if err := rows.Scan(&r1.Date, &r1.Amount, &r1.Count); err != nil { writeError(w, http.StatusInternalServerError, err); return }; out = append(out, r1) }
        writeJSON(w, http.StatusOK, out)
    })

    mux.HandleFunc("/api/analytics/top", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        by := r.URL.Query().Get("type")
        if by == "" { by = "campaign" }
        limit := 10; if v := r.URL.Query().Get("limit"); v != "" { var t int; fmt.Sscanf(v, "%d", &t); if t>0 && t<=100 { limit = t } }
        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()
        type kv struct{ Key string `json:"key"`; Total string `json:"total"` }
        var rows *sql.Rows
        if by == "donor" {
            rows, err = db.Query(`SELECT donor, COALESCE(SUM((amount)::numeric),0)::text AS total FROM donations GROUP BY donor ORDER BY SUM((amount)::numeric) DESC LIMIT $1`, limit)
        } else {
            rows, err = db.Query(`SELECT campaign_id, COALESCE(SUM((amount)::numeric),0)::text AS total FROM donations GROUP BY campaign_id ORDER BY SUM((amount)::numeric) DESC LIMIT $1`, limit)
        }
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer rows.Close()
        var out []kv
        for rows.Next() { var k kv; if err := rows.Scan(&k.Key, &k.Total); err != nil { writeError(w, http.StatusInternalServerError, err); return }; out = append(out, k) }
        writeJSON(w, http.StatusOK, out)
    })

    mux.HandleFunc("/api/analytics/gas", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        // 简化：从最近 N 条有 txHash 的捐赠收据估算平均 gasUsed 与平均手续费
        limit := 30; if v := r.URL.Query().Get("limit"); v != "" { var t int; fmt.Sscanf(v, "%d", &t); if t>0 && t<=200 { limit = t } }
        dsn := envOr("PG_DSN", "")
        db, err := sql.Open("postgres", dsn)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer db.Close()
        rows, err := db.Query(`SELECT tx_hash FROM donations WHERE tx_hash IS NOT NULL AND tx_hash <> '' ORDER BY created_at DESC LIMIT $1`, limit)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        defer rows.Close()
        rpc := os.Getenv("RPC_URL")
        type resp struct{ Sample int `json:"sample"`; AvgGasUsed string `json:"avgGasUsed"`; AvgGasPriceGwei string `json:"avgGasPriceGwei"`; AvgFeeETH string `json:"avgFeeETH"` }
        out := resp{Sample:0, AvgGasUsed:"0", AvgGasPriceGwei:"0", AvgFeeETH:"0"}
        if rpc == "" { writeJSON(w, http.StatusOK, out); return }
        client, err := ethclient.Dial(rpc)
        if err != nil { writeJSON(w, http.StatusOK, out); return }
        defer client.Close()
        var gasUsedSum int64; var priceSum = new(big.Int); var feeSum = new(big.Rat)
        for rows.Next() {
            var txh string; if err := rows.Scan(&txh); err==nil && txh!="" {
                h := common.HexToHash(txh)
                rcpt, e := client.TransactionReceipt(r.Context(), h)
                if e==nil && rcpt!=nil {
                    gasUsedSum += int64(rcpt.GasUsed)
                    tx, _, _ := client.TransactionByHash(r.Context(), h)
                    if tx!=nil {
                        price := tx.GasPrice()
                        priceSum = new(big.Int).Add(priceSum, price)
                        // fee = gasUsed * price (wei)
                        feeWei := new(big.Int).Mul(new(big.Int).SetUint64(rcpt.GasUsed), price)
                        // convert to ETH
                        f := new(big.Rat).SetInt(feeWei)
                        eth := new(big.Rat).SetFloat64(1e18)
                        feeSum = new(big.Rat).Add(feeSum, new(big.Rat).Quo(f, eth))
                        out.Sample++
                    }
                }
            }
        }
        if out.Sample>0 {
            avgGasUsed := gasUsedSum / int64(out.Sample)
            avgPrice := new(big.Int).Div(priceSum, big.NewInt(int64(out.Sample)))
            // gwei
            gwei := new(big.Rat).Quo(new(big.Rat).SetInt(avgPrice), new(big.Rat).SetFloat64(1e9))
            feeAvg := new(big.Rat).Quo(feeSum, new(big.Rat).SetInt64(int64(out.Sample)))
            out.AvgGasUsed = fmt.Sprintf("%d", avgGasUsed)
            out.AvgGasPriceGwei = gwei.FloatString(2)
            out.AvgFeeETH = feeAvg.FloatString(6)
        }
        writeJSON(w, http.StatusOK, out)
    })
}

func (s *Server) requireAdmin(w http.ResponseWriter, r *http.Request) bool {
	t, err := s.parseAuth(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, err)
		return false
	}
	if t.Role != "admin" {
		writeError(w, http.StatusForbidden, fmt.Errorf("admin required"))
		return false
	}
	return true
}
