package main

import (
    "database/sql"
    "encoding/json"
    "fmt"
    "net/http"
    "os"
    "strings"
    "time"

    "blockchain-backend/campaigns"
    "blockchain-backend/rewards"
    "blockchain-backend/email"
    "blockchain-backend/users"
    "math/big"
    "strconv"
)

func (s *Server) registerCampaignRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/campaigns", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        store, err := campaigns.NewPGStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        switch r.Method {
        case http.MethodGet:
            list, err := store.ListCampaigns()
            if err != nil { writeError(w, http.StatusInternalServerError, err); return }
            // 动态判断已达成目标的项目，将状态置为 completed（仅用于响应，不改库）
            for i := range list {
                if list[i].Status != "completed" {
                    g, r := new(big.Rat), new(big.Rat)
                    if (list[i].GoalAmount != "") && (list[i].RaisedAmount != "") {
                        if _, ok := g.SetString(list[i].GoalAmount); ok {
                            if _, ok2 := r.SetString(list[i].RaisedAmount); ok2 {
                                if g.Cmp(new(big.Rat)) > 0 && r.Cmp(g) >= 0 { list[i].Status = "completed" }
                            }
                        }
                    }
                }
            }
            writeJSON(w, http.StatusOK, list)
        case http.MethodPost:
            if !s.requireAdmin(w, r) { return }
            var body struct {
                ID          string `json:"id"`
                Title       string `json:"title"`
                Description string `json:"description"`
                GoalAmount  string `json:"goalAmount"`
                Image       string `json:"image"`
                Owner       string `json:"owner"`
                Status      string `json:"status"`
                Beneficiary string `json:"beneficiary"`
                MinDonation string `json:"minDonation"`
                StartAt     *time.Time `json:"startAt"`
                EndAt       *time.Time `json:"endAt"`
                CapAmount   string `json:"capAmount"`
            }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" || body.Title == "" || body.Description == "" || body.GoalAmount == "" {
                writeError(w, http.StatusBadRequest, err)
                return
            }
            c := campaigns.Campaign{ID: body.ID, Title: body.Title, Description: body.Description, GoalAmount: body.GoalAmount, Image: body.Image, Owner: body.Owner, Status: body.Status, Beneficiary: strings.ToLower(body.Beneficiary), WithdrawnAmount: "0", MinDonation: body.MinDonation, StartAt: body.StartAt, EndAt: body.EndAt, CapAmount: body.CapAmount, CreatedAt: time.Now()}
            if err := store.CreateCampaign(c); err != nil { writeError(w, http.StatusInternalServerError, err); return }
            writeJSON(w, http.StatusCreated, c)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    mux.HandleFunc("/api/campaigns/", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/campaigns/"), "/")
        if len(parts) < 1 || parts[0] == "" {
            w.WriteHeader(http.StatusBadRequest)
            return
        }
        id := parts[0]
        store, err := campaigns.NewPGStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        switch r.Method {
        case http.MethodGet:
            c, err := store.GetCampaign(id)
            if err != nil {
                if err == sql.ErrNoRows {
                    w.WriteHeader(http.StatusNotFound)
                    return
                }
                writeError(w, http.StatusInternalServerError, err)
                return
            }
            // 动态响应：若已达标则标记为 completed（不改库）
            if c.Status != "completed" && c.GoalAmount != "" && c.RaisedAmount != "" {
                g, r := new(big.Rat), new(big.Rat)
                if _, ok := g.SetString(c.GoalAmount); ok {
                    if _, ok2 := r.SetString(c.RaisedAmount); ok2 {
                        if g.Cmp(new(big.Rat)) > 0 && r.Cmp(g) >= 0 { c.Status = "completed" }
                    }
                }
            }
            dons, _ := store.ListDonations(id, 20)
            ups, _ := store.ListUpdates(id, 20)
            type resp struct {
                campaigns.Campaign
                Donations []campaigns.Donation `json:"donations"`
                Updates   []campaigns.Update   `json:"updates"`
            }
            writeJSON(w, http.StatusOK, resp{Campaign: c, Donations: dons, Updates: ups})
        case http.MethodPost:
            // /api/campaigns/{id}/donations 或 /api/campaigns/{id}/withdraw
            if len(parts) >= 2 && parts[1] == "donations" {
                var body struct {
                    ID     string `json:"id"`
                    Donor  string `json:"donor"`
                    Amount string `json:"amount"`
                    TxHash string `json:"txHash"`
                    Token  string `json:"token"`
                }
                if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ID == "" || body.Amount == "" {
                    writeError(w, http.StatusBadRequest, err)
                    return
                }
                // 校验项目时间/金额限制
                cam, _ := store.GetCampaign(id)
                now := time.Now()
                if cam.StartAt != nil && now.Before(*cam.StartAt) { writeError(w, http.StatusBadRequest, fmt.Errorf("campaign not started")); return }
                if cam.EndAt != nil && now.After(*cam.EndAt) { writeError(w, http.StatusBadRequest, fmt.Errorf("campaign ended")); return }
                // 若已完成（或已达目标）则拒绝继续捐赠
                if cam.Status == "completed" {
                    writeError(w, http.StatusBadRequest, fmt.Errorf("campaign completed"))
                    return
                }
                if cam.GoalAmount != "" && cam.RaisedAmount != "" {
                    g, r := new(big.Rat), new(big.Rat)
                    if _, ok := g.SetString(cam.GoalAmount); ok {
                        if _, ok2 := r.SetString(cam.RaisedAmount); ok2 {
                            if g.Cmp(new(big.Rat)) > 0 && r.Cmp(g) >= 0 {
                                writeError(w, http.StatusBadRequest, fmt.Errorf("campaign completed"))
                                return
                            }
                        }
                    }
                }
                if cam.MinDonation != "" {
                    a := new(big.Rat); a.SetString(body.Amount)
                    m := new(big.Rat); m.SetString(cam.MinDonation)
                    if a.Cmp(m) < 0 { writeError(w, http.StatusBadRequest, fmt.Errorf("amount below minDonation")); return }
                }
                if cam.CapAmount != "" {
                    cur := new(big.Rat); cur.SetString(cam.RaisedAmount)
                    add := new(big.Rat); add.SetString(body.Amount)
                    cap := new(big.Rat); cap.SetString(cam.CapAmount)
                    if new(big.Rat).Add(cur, add).Cmp(cap) > 0 { writeError(w, http.StatusBadRequest, fmt.Errorf("cap exceeded")); return }
                }
                d := campaigns.Donation{ID: body.ID, CampaignID: id, Donor: strings.ToLower(body.Donor), Amount: body.Amount, TxHash: body.TxHash, Token: body.Token, CreatedAt: now}
                if err := store.AddDonation(d); err != nil { writeError(w, http.StatusInternalServerError, err); return }
                _ = store.MaybeComplete(id)
                go s.awardOnCompletedCampaign(id)
                // 计算并发放积分/徽章（离线）
                go func() {
                    rstore, err := rewards.NewPGStore(envOr("PG_DSN", ""))
                    if err != nil { return }
                    // points = amount * pointPerETH
                    cfg, err := s.getRewardConfigInternal()
                    if err != nil { return }
                    amt := new(big.Rat)
                    if _, ok := amt.SetString(body.Amount); !ok { return }
                    ppe := new(big.Rat)
                    if _, ok := ppe.SetString(cfg.PointPerETH); !ok { ppe = big.NewRat(100,1) }
                    pts := new(big.Rat).Mul(amt, ppe)
                    // 向上取整积分
                    pointsStr := pts.FloatString(0)
                    // 反刷控制：检查每日上限与冷却
                    today := time.Now().UTC()
                    day := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC)
                    dailyPoints, lastAt, _ := rstore.GetDaily(strings.ToLower(body.Donor), day)
                    // 比较每日上限
                    // 简化：直接累加，若超过上限则截断为上限
                    capRat := new(big.Rat)
                    if _, ok := capRat.SetString(cfg.DailyCapPerAddress); !ok { capRat = big.NewRat(1000,1) }
                    curRat := new(big.Rat); curRat.SetString(dailyPoints)
                    addRat := new(big.Rat); addRat.SetString(pointsStr)
                    sumRat := new(big.Rat).Add(curRat, addRat)
                    if sumRat.Cmp(capRat) > 0 {
                        addRat = new(big.Rat).Sub(capRat, curRat)
                        if addRat.Sign() < 0 { addRat = big.NewRat(0,1) }
                    }
                    pointsStr = addRat.FloatString(0)
                    // 冷却：若上次时间距今小于 cooldownSeconds，则不记分
                    if lastAt.Valid && int(time.Since(lastAt.Time).Seconds()) < cfg.CooldownSeconds {
                        pointsStr = "0"
                    }
                    if pointsStr != "0" {
                        _ = rstore.AddPoints(strings.ToLower(body.Donor), pointsStr)
                        _ = rstore.AddDaily(strings.ToLower(body.Donor), day, pointsStr, time.Now())
                    }
                    _ = rstore.AddPoints(strings.ToLower(body.Donor), pointsStr)

                    // 发放徽章（基于阈值）
                    var thresholds map[string]string
                    _ = json.Unmarshal([]byte(cfg.NFTThresholdsJSON), &thresholds)
                    // 计算累计总额
                    // 直接复用 donations 表聚合
                    // 这里简化，重新打开 db 计算总额
                    // 为避免循环依赖，此处再次 Query
                    // 但我们已有 store，可扩展 Store 方法；此处先就地实现
                    // 读取累计 ETH
                    dsn := envOr("PG_DSN", "")
                    db2, err := sql.Open("postgres", dsn)
                    if err == nil {
                        defer db2.Close()
                        var totalEthStr string
                        if err := db2.QueryRow(`SELECT COALESCE(SUM((amount)::numeric),0)::text FROM donations WHERE LOWER(donor)=LOWER($1)`, strings.ToLower(body.Donor)).Scan(&totalEthStr); err == nil {
                            total := new(big.Rat)
                            if _, ok := total.SetString(totalEthStr); ok {
                                for name, v := range thresholds {
                                    need := new(big.Rat)
                                    if _, ok := need.SetString(v); ok {
                                        if total.Cmp(need) >= 0 {
                                            has, _ := rstore.HasBadge(strings.ToLower(body.Donor), name)
                                            if !has {
                                                // 尝试上链铸造（如配置），失败则仍发放离线徽章
                                                txh := ""
                                                if tx, err := s.mintBadgeNFT(strings.ToLower(body.Donor), name); err == nil {
                                                    txh = tx
                                                }
                                                saveHash := body.TxHash
                                                if txh != "" {
                                                    saveHash = txh
                                                }
                                                _ = rstore.IssueBadge(strings.ToLower(body.Donor), name, saveHash)
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }()

                // 发送收据邮件（如果地址已绑定邮箱）
                go func() {
                    userStore, err := users.NewStore(envOr("PG_DSN", ""))
                    if err != nil { return }
                    if emailAddr, ok, _ := userStore.GetEmailByAddress(strings.ToLower(body.Donor)); ok {
                        host := os.Getenv("SMTP_HOST")
                        portStr := os.Getenv("SMTP_PORT")
                        user := os.Getenv("SMTP_USER")
                        pass := os.Getenv("SMTP_PASS")
                        from := os.Getenv("SMTP_FROM")
                        if host != "" && portStr != "" && from != "" {
                            var port int
                            fmt.Sscanf(portStr, "%d", &port)
                            subj := "感谢您的爱心捐赠"
                            bodyTxt := fmt.Sprintf("感谢您的捐赠！\n\n项目ID: %s\n金额: %s %s\n交易哈希: %s\n时间: %s\n\n祝好！", id, body.Amount, body.Token, d.TxHash, time.Now().Format(time.RFC3339))
                            _ = email.SendSMTP(host, port, user, pass, from, []string{emailAddr}, subj, bodyTxt)
                        }
                    }
                }()
                writeJSON(w, http.StatusCreated, d)
                return
            }
            if len(parts) >= 2 && parts[1] == "updates" {
                // 机构或管理员可发布更新
                t, err := s.parseAuth(r)
                if err != nil { writeError(w, http.StatusUnauthorized, err); return }
                // 权限：管理员或机构地址（已批准）
                userStore, _ := users.NewStore(envOr("PG_DSN", ""))
                isOrg, _ := userStore.IsOrgApproved(strings.ToLower(t.Address))
                if t.Role != "admin" && !isOrg { writeError(w, http.StatusForbidden, fmt.Errorf("forbidden")); return }
                var body struct{ ID, Content string }
                if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Content == "" { writeError(w, http.StatusBadRequest, err); return }
                u := campaigns.Update{ID: body.ID, CampaignID: id, Author: strings.ToLower(t.Address), Content: body.Content, CreatedAt: time.Now()}
                if u.ID == "" { u.ID = fmt.Sprintf("%s-%d", id, time.Now().UnixNano()) }
                if err := store.CreateUpdate(u); err != nil { writeError(w, http.StatusInternalServerError, err); return }
                writeJSON(w, http.StatusCreated, u)
                return
            }
            if len(parts) >= 2 && parts[1] == "withdraw" {
                if !s.requireAdmin(w, r) { return }
                var body struct { Amount string `json:"amount"` }
                if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Amount == "" { writeError(w, http.StatusBadRequest, err); return }
                // 更新已提现金额与时间
                if _, err := s.dbExec(`UPDATE campaigns SET withdrawn_amount = ((COALESCE(NULLIF(withdrawn_amount,''),'0'))::numeric + ($1)::numeric)::text, last_withdraw_at=NOW() WHERE id=$2`, body.Amount, id); err != nil {
                    writeError(w, http.StatusInternalServerError, err); return
                }
                _ = store.MaybeComplete(id)
                writeJSON(w, http.StatusOK, map[string]string{"status":"withdrawn"})
                return
            }
            w.WriteHeader(http.StatusNotFound)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })

    // donations query
    mux.HandleFunc("/api/donations", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        if r.Method != http.MethodGet { w.WriteHeader(http.StatusMethodNotAllowed); return }
        store, err := campaigns.NewPGStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        addr := r.URL.Query().Get("address")
        cid := r.URL.Query().Get("campaignId")
        fromStr := r.URL.Query().Get("from")
        toStr := r.URL.Query().Get("to")
        pageStr := r.URL.Query().Get("page")
        psStr := r.URL.Query().Get("pageSize")
        var fromPtr, toPtr *time.Time
        if fromStr != "" { if t, err := time.Parse(time.RFC3339, fromStr); err == nil { fromPtr = &t } }
        if toStr != "" { if t, err := time.Parse(time.RFC3339, toStr); err == nil { toPtr = &t } }
        page := 1; if pageStr != "" { if p, err := strconv.Atoi(pageStr); err == nil { page = p } }
        ps := 20; if psStr != "" { if p, err := strconv.Atoi(psStr); err == nil { ps = p } }
        items, err := store.QueryDonations(strings.ToLower(addr), cid, fromPtr, toPtr, page, ps)
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        writeJSON(w, http.StatusOK, items)
    })
}


