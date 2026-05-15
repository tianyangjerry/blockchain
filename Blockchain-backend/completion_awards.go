package main

import (
    "log"
    "strings"
    "blockchain-backend/campaigns"
    "blockchain-backend/rewards"
)

// awardOnCompletedCampaign tries to mint an NFT badge for the beneficiary
// when a campaign reaches completed status. It is idempotent via reward_badges.
func (s *Server) awardOnCompletedCampaign(campaignID string) {
    store, err := campaigns.NewPGStore(envOr("PG_DSN", ""))
    if err != nil { return }
    cam, err := store.GetCampaign(campaignID)
    if err != nil { return }
    if strings.ToLower(cam.Status) != "completed" { return }
    if cam.Beneficiary == "" { return }
    bene := strings.ToLower(cam.Beneficiary)

    rstore, err := rewards.NewPGStore(envOr("PG_DSN", ""))
    if err != nil { return }
    // 人类可读的徽章名称，便于前端展示
    badge := "Beneficiary Completed: " + campaignID
    has, _ := rstore.HasBadge(bene, badge)
    if has { return }

    // Try on-chain mint first, fall back to off-chain record
    txh := ""
    if tx, err := s.mintBadgeNFT(bene, "beneficiary-completed:"+campaignID); err == nil {
        txh = tx
    } else {
        log.Printf("[completion-awards] mint badge failed (fallback to off-chain): %v", err)
    }
    _ = rstore.IssueBadge(bene, badge, txh)
}


