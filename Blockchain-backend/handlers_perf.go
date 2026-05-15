package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

// Admin-only performance tooling endpoints
func (s *Server) registerPerfRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/admin/perf/bulk", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !s.requireAdmin(w, r) {
			return
		}
		var body struct {
			Campaigns   int  `json:"campaigns"`
			Donations   int  `json:"donations"`
			Withdrawals bool `json:"withdrawals"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeError(w, http.StatusBadRequest, err)
			return
		}
		dsn := envOr("PG_DSN", "")
		db, err := sql.Open("postgres", dsn)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
		defer db.Close()

		// Ensure extension for UUID digest helper
		if _, err := db.Exec(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`); err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}

		if body.Campaigns > 0 {
			sqlCamp := `DO $$
DECLARE n INTEGER := %d; BEGIN
INSERT INTO campaigns(id, title, description, goal_amount, created_at)
SELECT 'cmp-'||encode(digest(gen_random_uuid()::text,'md5'),'hex'),
       'Auto campaign '||gs,
       'Seeded for perf test',
       (100 + floor(random()*900))::text,
       NOW() - (random()*INTERVAL '60 days')
FROM generate_series(1, n) gs;
END $$;`
			if _, err := db.Exec(fmt.Sprintf(sqlCamp, body.Campaigns)); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
		}

		if body.Donations > 0 {
			sqlDon := `DO $$
DECLARE n INTEGER := %d; BEGIN
CREATE TEMP TABLE _u AS SELECT address FROM users WHERE address IS NOT NULL;
CREATE TEMP TABLE _c AS SELECT id FROM campaigns;
IF (SELECT COUNT(*) FROM _u)=0 OR (SELECT COUNT(*) FROM _c)=0 THEN RETURN; END IF;
INSERT INTO donations(id, campaign_id, donor, amount, tx_hash, token, created_at)
SELECT encode(digest(gen_random_uuid()::text,'md5'),'hex'),
       (SELECT id FROM _c ORDER BY random() LIMIT 1),
       (SELECT address FROM _u ORDER BY random() LIMIT 1),
       ((random()*0.5 + 0.01)::numeric(20,8))::text,
       '',
       'ETH',
       NOW() - (random()*INTERVAL '30 days')
FROM generate_series(1, n);
UPDATE campaigns c SET raised_amount = x.total::text
FROM (
  SELECT campaign_id, COALESCE(SUM((amount)::numeric),0) AS total
  FROM donations GROUP BY campaign_id
) x
WHERE c.id = x.campaign_id;
END $$;`
			if _, err := db.Exec(fmt.Sprintf(sqlDon, body.Donations)); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
		}

		if body.Withdrawals {
			sqlW := `DO $$ BEGIN
UPDATE campaigns SET
  withdrawn_amount = LEAST((COALESCE(NULLIF(raised_amount,''),'0'))::numeric,
                           ((COALESCE(NULLIF(raised_amount,''),'0'))::numeric * (random()*0.7))::numeric)::text,
  last_withdraw_at = NOW() - (random()*INTERVAL '10 days')
WHERE random() < 0.5;
END $$;`
			if _, err := db.Exec(sqlW); err != nil {
				writeError(w, http.StatusInternalServerError, err)
				return
			}
		}

		writeJSON(w, http.StatusOK, map[string]any{
			"status":      "ok",
			"campaigns":   body.Campaigns,
			"donations":   body.Donations,
			"withdrawals": body.Withdrawals,
		})
	})
}

// 注意：原来这里有一组 analytics 路由实现，但在另一个文件中已存在同名的
// `registerAnalyticsRoutes` 实现，导致编译时重复声明错误。为避免重复并使用
// 统一实现，这里移除重复定义（保留其它 perf 辅助接口）。
// 如果需要合并两份实现，请在此处整合逻辑后恢复函数。
