package main

import (
    "context"
    "database/sql"
    "encoding/hex"
    "encoding/json"
    "fmt"
    "log"
    "math/big"
    "os"
    "strconv"
    "strings"
    "time"

    "blockchain-backend/campaigns"

    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/ethereum/go-ethereum/common"
    ethereum "github.com/ethereum/go-ethereum"
    "github.com/ethereum/go-ethereum/core/types"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
    _ "github.com/lib/pq"
)

// Minimal ABI for DonationReceived and Withdrawn
const donationEventABI = `[
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"donor","type":"address"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"DonationReceived","type":"event"},
  {"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"id","type":"bytes32"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Withdrawn","type":"event"}
]`

func (s *Server) StartDonationWatcher() {
    addr := strings.TrimSpace(os.Getenv("DONATION_CONTRACT_ADDRESS"))
    if addr == "" {
        log.Printf("[donation-watcher] DONATION_CONTRACT_ADDRESS not set, watcher disabled")
        return
    }
    rpcURL := strings.TrimSpace(os.Getenv("RPC_URL"))
    if rpcURL == "" {
        log.Printf("[donation-watcher] RPC_URL not set, watcher disabled")
        return
    }
    go func() {
        for {
            if err := s.runDonationWatcherPolling(rpcURL, common.HexToAddress(addr)); err != nil {
                log.Printf("[donation-watcher] error: %v, retry in 5s", err)
                time.Sleep(5 * time.Second)
                continue
            }
            time.Sleep(3 * time.Second)
        }
    }()
}

// Polling-based watcher compatible with HTTP-only RPC (e.g., Ganache)
func (s *Server) runDonationWatcherPolling(rpcURL string, contract common.Address) error {
    client, err := ethclient.Dial(rpcURL)
    if err != nil {
        return err
    }
    defer client.Close()

    parsed, err := abi.JSON(strings.NewReader(donationEventABI))
    if err != nil {
        return err
    }
    evtDon := parsed.Events["DonationReceived"].ID
    evtWdr := parsed.Events["Withdrawn"].ID

    // Load cursor and from block
    curStore, err := NewWatcherCursorStore(envOr("PG_DSN", ""))
    if err != nil { return err }
    startBlock, _ := curStore.Get("donation:DonationReceived")
    if env := os.Getenv("DONATION_START_BLOCK"); env != "" {
        if n, e := strconv.ParseInt(env, 10, 64); e == nil && n > startBlock { startBlock = n }
    }

    store, err := campaigns.NewPGStore(envOr("PG_DSN", ""))
    if err != nil { return err }

    // DB connection for writing tx_metrics
    db, err := sql.Open("postgres", envOr("PG_DSN", ""))
    if err != nil { return err }
    defer db.Close()

    log.Printf("[donation-watcher] polling %s on %s from %d", contract.Hex(), rpcURL, startBlock)
    ctx := context.Background()
    for {
        latest, err := client.BlockNumber(ctx)
        if err != nil { time.Sleep(2*time.Second); continue }
        if int64(latest) <= startBlock {
            time.Sleep(2 * time.Second)
            continue
        }
        from := startBlock + 1
        to := int64(latest)
        q := ethereum.FilterQuery{ Addresses: []common.Address{contract}, Topics: [][]common.Hash{{evtDon, evtWdr}}, FromBlock: big.NewInt(from), ToBlock: big.NewInt(to) }
        logs, err := client.FilterLogs(ctx, q)
        if err != nil { time.Sleep(2*time.Second); continue }
        for _, lg := range logs {
            if len(lg.Topics) < 4 { continue }
            idHash := lg.Topics[1].Bytes()
            campaignID := s.mapCampaignID(store, idHash)
            if campaignID == "" { campaignID = "0x" + hex.EncodeToString(idHash) }

            var amount = new(big.Int).SetBytes(lg.Data)
            tokenAddr := common.BytesToAddress(lg.Topics[3].Bytes())
            amountStr := amount.String()
            tokenLabel := tokenAddr.Hex()
            if (tokenAddr == common.Address{}) { tokenLabel = "ETH"; amountStr = toDecimalString(amount, 18) }

            switch lg.Topics[0] {
            case evtDon:
                donor := common.BytesToAddress(lg.Topics[2].Bytes())
                did := fmt.Sprintf("%s:%d", lg.TxHash.Hex(), lg.Index)
                d := campaigns.Donation{ID: did, CampaignID: campaignID, Donor: strings.ToLower(donor.Hex()), Amount: amountStr, TxHash: lg.TxHash.Hex(), Token: tokenLabel, CreatedAt: time.Now()}
                if err := store.AddDonation(d); err != nil { log.Printf("[donation-watcher] AddDonation error: %v", err) } else {
                    _ = store.MaybeComplete(campaignID)
                    go s.awardOnCompletedCampaign(campaignID)
                    log.Printf("[donation-watcher] donation synced: %s %s %s", campaignID, donor.Hex(), amountStr)
                }
                // record tx metrics for donation
                go func(lg types.Log) {
                    ctx := context.Background()
                    // fetch receipt
                    receipt, rerr := client.TransactionReceipt(ctx, lg.TxHash)
                    if rerr != nil {
                        log.Printf("[donation-watcher] receipt error: %v", rerr)
                        return
                    }
                    gasUsed := int64(receipt.GasUsed)
                    effGasPrice := new(big.Int)
                    if receipt.EffectiveGasPrice != nil {
                        effGasPrice = receipt.EffectiveGasPrice
                    } else {
                        effGasPrice = big.NewInt(0)
                    }
                    // compute tx fee in ETH (as float64)
                    feeWei := new(big.Int).Mul(effGasPrice, new(big.Int).SetUint64(receipt.GasUsed))
                    feeEthFloat := new(big.Float).Quo(new(big.Float).SetInt(feeWei), big.NewFloat(1e18))
                    feeEth, _ := feeEthFloat.Float64()
                    // get block header for timestamp
                    blk, berr := client.HeaderByNumber(ctx, big.NewInt(int64(lg.BlockNumber)))
                    var ts time.Time
                    if berr == nil {
                        ts = time.Unix(int64(blk.Time), 0)
                    } else {
                        ts = time.Now()
                    }
                    // prepare logs JSON
                    logsJSON, _ := json.Marshal(lg)
                    // insert into tx_metrics
                    _, ierr := db.ExecContext(ctx, `
INSERT INTO tx_metrics(tx_hash, block_number, timestamp, from_address, to_address, contract_address, method, campaign_id, value, gas_used, effective_gas_price, tx_fee_eth, status, logs)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
ON CONFLICT (tx_hash) DO NOTHING
`, lg.TxHash.Hex(), lg.BlockNumber, ts, "", lg.Address.Hex(), lg.Address.Hex(), "DonationReceived", campaignID, amountStr, gasUsed, effGasPrice.String(), feeEth, receipt.Status, string(logsJSON))
                    if ierr != nil {
                        log.Printf("[donation-watcher] insert tx_metrics error: %v", ierr)
                    }
                }(lg)
            case evtWdr:
                if err := store.AddWithdrawAmount(campaignID, amountStr); err != nil { log.Printf("[donation-watcher] AddWithdrawAmount error: %v", err) }
                // record tx metrics for withdraw
                go func(lg types.Log) {
                    ctx := context.Background()
                    receipt, rerr := client.TransactionReceipt(ctx, lg.TxHash)
                    if rerr != nil {
                        log.Printf("[donation-watcher] receipt error: %v", rerr)
                        return
                    }
                    gasUsed := int64(receipt.GasUsed)
                    effGasPrice := new(big.Int)
                    if receipt.EffectiveGasPrice != nil {
                        effGasPrice = receipt.EffectiveGasPrice
                    } else {
                        effGasPrice = big.NewInt(0)
                    }
                    feeWei := new(big.Int).Mul(effGasPrice, new(big.Int).SetUint64(receipt.GasUsed))
                    feeEthFloat := new(big.Float).Quo(new(big.Float).SetInt(feeWei), big.NewFloat(1e18))
                    feeEth, _ := feeEthFloat.Float64()
                    blk, berr := client.HeaderByNumber(ctx, big.NewInt(int64(lg.BlockNumber)))
                    var ts time.Time
                    if berr == nil {
                        ts = time.Unix(int64(blk.Time), 0)
                    } else {
                        ts = time.Now()
                    }
                    logsJSON, _ := json.Marshal(lg)
                    _, ierr := db.ExecContext(ctx, `
INSERT INTO tx_metrics(tx_hash, block_number, timestamp, from_address, to_address, contract_address, method, campaign_id, value, gas_used, effective_gas_price, tx_fee_eth, status, logs)
VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
ON CONFLICT (tx_hash) DO NOTHING
`, lg.TxHash.Hex(), lg.BlockNumber, ts, "", lg.Address.Hex(), lg.Address.Hex(), "Withdrawn", campaignID, amountStr, gasUsed, effGasPrice.String(), feeEth, receipt.Status, string(logsJSON))
                    if ierr != nil {
                        log.Printf("[donation-watcher] insert tx_metrics error: %v", ierr)
                    }
                }(lg)
            }
        }
        _ = curStore.Set("donation:DonationReceived", to)
        startBlock = to
        time.Sleep(2 * time.Second)
    }
}

// removed helper; using ethereum.FilterQuery directly

func (s *Server) mapCampaignID(store *campaigns.PGStore, idHash []byte) string {
    list, err := store.ListCampaigns()
    if err != nil { return "" }
    // 尝试精确匹配（原始 ID）
    for _, c := range list {
        h := crypto.Keccak256([]byte(c.ID))
        if len(h) == len(idHash) && equalBytes(h, idHash) {
            return c.ID
        }
    }
    // 容错：去空格、统一小写再比较（避免大小写或两端空白造成的偏差）
    for _, c := range list {
        norm := strings.ToLower(strings.TrimSpace(c.ID))
        if norm == c.ID { continue }
        h := crypto.Keccak256([]byte(norm))
        if len(h) == len(idHash) && equalBytes(h, idHash) {
            return c.ID // 返回原始 ID，保持与数据库一致
        }
    }
    return ""
}

func equalBytes(a, b []byte) bool {
    if len(a) != len(b) { return false }
    for i := range a { if a[i] != b[i] { return false } }
    return true
}

func toDecimalString(n *big.Int, decimals int) string {
    if decimals <= 0 { return n.String() }
    s := n.String()
    if len(s) <= decimals {
        // pad zeros
        pad := make([]byte, decimals-len(s)+1)
        for i := range pad { pad[i] = '0' }
        s = string(pad) + s
    }
    i := len(s) - decimals
    intPart := s[:i]
    fracPart := strings.TrimRight(s[i:], "0")
    if fracPart == "" { return intPart }
    return intPart + "." + fracPart
}


