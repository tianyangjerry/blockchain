package campaigns

import "time"

type Campaign struct {
    ID          string    `json:"id"`
    Title       string    `json:"title"`
    Description string    `json:"description"`
    GoalAmount  string    `json:"goalAmount"`
    RaisedAmount string   `json:"raisedAmount"`
    Image       string    `json:"image,omitempty"`
    Owner       string    `json:"owner,omitempty"`
    Status      string    `json:"status,omitempty"`
    Beneficiary string    `json:"beneficiary,omitempty"`
    WithdrawnAmount string `json:"withdrawnAmount,omitempty"`
    LastWithdrawAt  *time.Time `json:"lastWithdrawAt,omitempty"`
    MinDonation string    `json:"minDonation,omitempty"`
    StartAt     *time.Time `json:"startAt,omitempty"`
    EndAt       *time.Time `json:"endAt,omitempty"`
    CapAmount   string    `json:"capAmount,omitempty"`
    CreatedAt   time.Time `json:"createdAt"`
}

type Donation struct {
    ID         string    `json:"id"`
    CampaignID string    `json:"campaignId"`
    Donor      string    `json:"donor"`
    Amount     string    `json:"amount"`
    TxHash     string    `json:"txHash,omitempty"`
    Token      string    `json:"token,omitempty"`
    CreatedAt  time.Time `json:"timestamp"`
}

type Update struct {
    ID         string    `json:"id"`
    CampaignID string    `json:"campaignId"`
    Author     string    `json:"author"`
    Content    string    `json:"content"`
    CreatedAt  time.Time `json:"createdAt"`
}


