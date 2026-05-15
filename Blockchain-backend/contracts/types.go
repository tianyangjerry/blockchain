package contracts

import "time"

type ContractRecord struct {
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	ABI       string    `json:"abi"`
	Network   string    `json:"network"`
	TxHash    string    `json:"txHash"`
	CreatedAt time.Time `json:"createdAt"`
}
