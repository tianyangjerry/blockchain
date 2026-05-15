package main

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/crypto"
)

func verifyPersonalSign(address string, message string, signatureHex string) error {
	prefix := "\x19Ethereum Signed Message:\n"
	msg := []byte(message)
	digest := crypto.Keccak256Hash([]byte(prefix + fmt.Sprint(len(msg)) + string(msg)))
	sig, err := hex.DecodeString(strings.TrimPrefix(signatureHex, "0x"))
	if err != nil {
		return err
	}
	if len(sig) != 65 {
		return fmt.Errorf("bad signature length")
	}
	if sig[64] >= 27 {
		sig[64] -= 27
	}
	pubKey, err := crypto.SigToPub(digest.Bytes(), sig)
	if err != nil {
		return err
	}
	recovered := crypto.PubkeyToAddress(*pubKey)
	if strings.ToLower(recovered.Hex()) != strings.ToLower(address) {
		return fmt.Errorf("address mismatch")
	}
	return nil
}
