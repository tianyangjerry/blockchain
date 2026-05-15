package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"blockchain-backend/contracts"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

func (s *Server) registerContractRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/contracts", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		switch r.Method {
		case http.MethodGet:
			s.handleListContracts(w, r)
		case http.MethodPost:
			if !s.requireAdmin(w, r) {
				return
			}
			s.handleCreateContract(w, r)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/contracts/deploy", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if !s.requireAdmin(w, r) {
			return
		}
		s.handleDeployContract(w, r)
	})

	mux.HandleFunc("/api/contracts/", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w, r)
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/contracts/"), "/")
		if len(parts) < 1 || parts[0] == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		addr := parts[0]
		rec, ok := s.store.Get(addr)
		if !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeJSON(w, http.StatusOK, rec)
	})
}

func (s *Server) handleListContracts(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("DEBUG: 开始获取合约列表\n")
	list, err := s.store.List()
	if err != nil {
		fmt.Printf("DEBUG: 获取合约列表失败: %v\n", err)
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	fmt.Printf("DEBUG: 获取到 %d 个合约\n", len(list))
	writeJSON(w, http.StatusOK, list)
}

type CreateContractRequest struct {
	Name    string `json:"name"`
	Address string `json:"address"`
	ABI     string `json:"abi"`
	Network string `json:"network"`
	TxHash  string `json:"txHash"`
}

func (s *Server) handleCreateContract(w http.ResponseWriter, r *http.Request) {
	var req CreateContractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid json: %w", err))
		return
	}
	if req.Name == "" || req.Address == "" || req.ABI == "" {
		writeError(w, http.StatusBadRequest, fmt.Errorf("name, address, abi required"))
		return
	}
	rec := contracts.ContractRecord{Name: req.Name, Address: req.Address, ABI: req.ABI, Network: req.Network, TxHash: req.TxHash, CreatedAt: time.Now()}
	if err := s.store.Put(rec); err != nil {
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, rec)
}

type DeployRequest struct {
	Name           string            `json:"name"`
	ABI            string            `json:"abi"`
	BytecodeHex    string            `json:"bytecode"`
	ConstructorArg []interface{}     `json:"constructorArgs"`
	Network        string            `json:"network"`
	Overrides      map[string]string `json:"overrides"`
}

func (s *Server) handleDeployContract(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("DEBUG: /api/contracts/deploy received\n")
	rpcURL := os.Getenv("RPC_URL")
	privHex := os.Getenv("PRIVATE_KEY")
	if rpcURL == "" || privHex == "" {
		fmt.Printf("DEBUG: deploy config missing: RPC_URL or PRIVATE_KEY is empty\n")
		writeError(w, http.StatusNotImplemented, fmt.Errorf("backend deploy not configured (set RPC_URL and PRIVATE_KEY)"))
		return
	}
	var req DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		fmt.Printf("DEBUG: decode deploy request error: %v\n", err)
		writeError(w, http.StatusBadRequest, err)
		return
	}
	fmt.Printf("DEBUG: deploy request parsed: name=%q, abi_len=%d, bytecode_len=%d, args_len=%d, network=%q\n", req.Name, len(req.ABI), len(req.BytecodeHex), len(req.ConstructorArg), req.Network)
	if req.ABI == "" || req.BytecodeHex == "" || req.Name == "" {
		fmt.Printf("DEBUG: invalid request: missing name/abi/bytecode\n")
		writeError(w, http.StatusBadRequest, fmt.Errorf("name, abi, bytecode required"))
		return
	}
	parsedABI, err := abi.JSON(strings.NewReader(req.ABI))
	if err != nil {
		fmt.Printf("DEBUG: invalid abi: %v\n", err)
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid abi: %w", err))
		return
	}
	fmt.Printf("DEBUG: ABI parsed successfully\n")
	bytecode, err := hex.DecodeString(strings.TrimPrefix(req.BytecodeHex, "0x"))
	if err != nil {
		fmt.Printf("DEBUG: invalid bytecode: %v\n", err)
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid bytecode hex: %w", err))
		return
	}
	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		fmt.Printf("DEBUG: ethclient dial error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	defer client.Close()
	privKey, err := crypto.HexToECDSA(strings.TrimPrefix(privHex, "0x"))
	if err != nil {
		fmt.Printf("DEBUG: invalid private key: %v\n", err)
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid private key"))
		return
	}
	pub := privKey.Public()
	pubECDSA, ok := pub.(*ecdsa.PublicKey)
	if !ok {
		fmt.Printf("DEBUG: invalid public key from private key\n")
		writeError(w, http.StatusBadRequest, fmt.Errorf("invalid public key"))
		return
	}
	fromAddr := crypto.PubkeyToAddress(*pubECDSA)
	chainID, err := client.ChainID(context.Background())
	if err != nil {
		fmt.Printf("DEBUG: get chain id error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	fmt.Printf("DEBUG: connected chain id=%s, from=%s\n", chainID.String(), fromAddr.Hex())
	nonce, err := client.PendingNonceAt(context.Background(), fromAddr)
	if err != nil {
		fmt.Printf("DEBUG: get nonce error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	gasPrice, err := client.SuggestGasPrice(context.Background())
	if err != nil {
		fmt.Printf("DEBUG: suggest gas price error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	auth, err := bind.NewKeyedTransactorWithChainID(privKey, chainID)
	if err != nil {
		fmt.Printf("DEBUG: keyed transactor error: %v\n", err)
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	auth.Nonce = big.NewInt(int64(nonce))
	auth.Value = big.NewInt(0)
	auth.GasPrice = gasPrice
	if auth.GasLimit == 0 {
		auth.GasLimit = 6_000_000
	}
	fmt.Printf("DEBUG: prepared tx opts nonce=%d gasPrice=%s\n", nonce, gasPrice.String())

	// coerce constructor args
	coerced := make([]interface{}, 0, len(req.ConstructorArg))
	for i, input := range parsedABI.Constructor.Inputs {
		var v interface{}
		if i < len(req.ConstructorArg) {
			v = req.ConstructorArg[i]
		}
		switch input.Type.T {
		case abi.StringTy:
			s, ok := v.(string)
			if !ok {
				writeError(w, http.StatusBadRequest, fmt.Errorf("arg %d expected string", i))
				return
			}
			coerced = append(coerced, s)
		case abi.UintTy, abi.IntTy:
			switch val := v.(type) {
			case string:
				bi := new(big.Int)
				if _, ok := bi.SetString(val, 10); !ok {
					writeError(w, http.StatusBadRequest, fmt.Errorf("arg %d invalid integer string", i))
					return
				}
				coerced = append(coerced, bi)
			case float64:
				coerced = append(coerced, big.NewInt(int64(val)))
			default:
				writeError(w, http.StatusBadRequest, fmt.Errorf("arg %d invalid integer type", i))
				return
			}
		case abi.AddressTy:
			s, ok := v.(string)
			if !ok {
				writeError(w, http.StatusBadRequest, fmt.Errorf("arg %d expected address string", i))
				return
			}
			coerced = append(coerced, common.HexToAddress(s))
		default:
			coerced = append(coerced, v)
		}
	}
	fmt.Printf("DEBUG: coerced args count=%d\n", len(coerced))

	address, tx, _, err := bind.DeployContract(auth, parsedABI, bytecode, client, coerced...)
	if err != nil {
		fmt.Printf("DEBUG: deploy error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	fmt.Printf("DEBUG: tx sent: %s, contract addr=%s, waiting mined...\n", tx.Hash().Hex(), address.Hex())
	if _, err := bind.WaitMined(context.Background(), client, tx); err != nil {
		fmt.Printf("DEBUG: wait mined error: %v\n", err)
		writeError(w, http.StatusBadGateway, err)
		return
	}
	fmt.Printf("DEBUG: tx mined: %s\n", tx.Hash().Hex())

	rec := contracts.ContractRecord{Name: req.Name, Address: address.Hex(), ABI: req.ABI, Network: req.Network, TxHash: tx.Hash().Hex(), CreatedAt: time.Now()}
	fmt.Printf("DEBUG: 准备保存合约到数据库: %+v\n", rec)
	if err := s.store.Put(rec); err != nil {
		fmt.Printf("DEBUG: 保存合约到数据库失败: %v\n", err)
		writeError(w, http.StatusInternalServerError, err)
		return
	}
	fmt.Printf("DEBUG: 合约已成功保存到数据库\n")
	writeJSON(w, http.StatusOK, rec)
}
