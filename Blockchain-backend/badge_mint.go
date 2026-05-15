package main

import (
    "context"
    "encoding/json"
    "fmt"
    "math/big"
    "os"
    "strings"

    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/ethereum/go-ethereum/accounts/abi/bind"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/crypto"
    "github.com/ethereum/go-ethereum/ethclient"
)

// mintBadgeNFT 在配置存在时调用徽章 NFT 合约进行铸造
// 需要环境变量：
// - RPC_URL
// - PRIVATE_KEY
// - BADGE_NFT_ADDRESS (0x...)
// - BADGE_NFT_MINT_FN (可选，默认 safeMint)
// - BADGE_NFT_URI_PREFIX (可选，默认 "badge:")
func (s *Server) mintBadgeNFT(toAddress, badge string) (string, error) {
    addr := strings.TrimSpace(os.Getenv("BADGE_NFT_ADDRESS"))
    if addr == "" {
        return "", fmt.Errorf("badge nft address not configured")
    }
    rpcURL := strings.TrimSpace(os.Getenv("RPC_URL"))
    privHex := strings.TrimSpace(os.Getenv("PRIVATE_KEY"))
    if rpcURL == "" || privHex == "" {
        return "", fmt.Errorf("rpc or private key not configured")
    }
    fn := strings.TrimSpace(os.Getenv("BADGE_NFT_MINT_FN"))
    if fn == "" { fn = "safeMint" }
    uriPrefix := os.Getenv("BADGE_NFT_URI_PREFIX")
    if uriPrefix == "" { uriPrefix = "badge:" }
    uri := uriPrefix + badge

    // 构造最小 ABI：function <fn>(address to, string uri)
    abiJSON := map[string]interface{}{
        "inputs": []map[string]string{{"internalType":"address","name":"to","type":"address"},{"internalType":"string","name":"uri","type":"string"}},
        "name": fn,
        "outputs": []interface{}{},
        "stateMutability": "nonpayable",
        "type": "function",
    }
    abiBytes, _ := json.Marshal([]interface{}{abiJSON})
    parsed, err := abi.JSON(strings.NewReader(string(abiBytes)))
    if err != nil {
        return "", fmt.Errorf("abi parse error: %w", err)
    }

    client, err := ethclient.Dial(rpcURL)
    if err != nil { return "", err }
    defer client.Close()
    chainID, err := client.ChainID(context.Background())
    if err != nil { return "", err }
    privKey, err := crypto.HexToECDSA(strings.TrimPrefix(privHex, "0x"))
    if err != nil { return "", err }
    auth, err := bind.NewKeyedTransactorWithChainID(privKey, chainID)
    if err != nil { return "", err }
    if auth.GasLimit == 0 { auth.GasLimit = 200_000 }

    contractAddr := common.HexToAddress(addr)
    bound := bind.NewBoundContract(contractAddr, parsed, client, client, client)
    to := common.HexToAddress(toAddress)

    tx, err := bound.Transact(auth, fn, to, uri)
    if err != nil { return "", err }
    // 可选等待：此处直接返回 tx hash，后台其他流程可按需等待
    _ = big.NewInt(0) // avoid unused import warning for big if optimized away
    return tx.Hash().Hex(), nil
}


