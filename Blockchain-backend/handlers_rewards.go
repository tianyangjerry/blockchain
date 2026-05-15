package main

import (
    "encoding/json"
    "net/http"
    "time"

    "blockchain-backend/rewards"
)

const rewardsConfigID = "default"

func (s *Server) registerRewardRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/rewards/config", func(w http.ResponseWriter, r *http.Request) {
        enableCORS(w, r)
        store, err := rewards.NewPGStore(envOr("PG_DSN", ""))
        if err != nil { writeError(w, http.StatusInternalServerError, err); return }
        switch r.Method {
        case http.MethodGet:
            c, err := store.GetConfig(rewardsConfigID)
            if err != nil {
                // 若未配置，返回合理默认值
                c = rewards.Config{
                    ID: rewardsConfigID,
                    PointPerETH: "100",
                    NFTThresholdsJSON: `{"bronze":"0.1","silver":"1","gold":"5"}`,
                    DailyCapPerAddress: "1000",
                    CooldownSeconds: 60,
                    UpdatedAt: time.Now(),
                }
                _ = store.UpsertConfig(c)
            }
            writeJSON(w, http.StatusOK, c)
        case http.MethodPost:
            if !s.requireAdmin(w, r) { return }
            var body struct {
                PointPerETH string `json:"pointPerETH"`
                NFTThresholdsJSON string `json:"nftThresholdsJson"`
                DailyCapPerAddress string `json:"dailyCapPerAddress"`
                CooldownSeconds int `json:"cooldownSeconds"`
            }
            if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
                writeError(w, http.StatusBadRequest, err)
                return
            }
            c := rewards.Config{ID: rewardsConfigID, PointPerETH: body.PointPerETH, NFTThresholdsJSON: body.NFTThresholdsJSON, DailyCapPerAddress: body.DailyCapPerAddress, CooldownSeconds: body.CooldownSeconds, UpdatedAt: time.Now()}
            if err := store.UpsertConfig(c); err != nil { writeError(w, http.StatusInternalServerError, err); return }
            writeJSON(w, http.StatusOK, c)
        default:
            w.WriteHeader(http.StatusMethodNotAllowed)
        }
    })
}


