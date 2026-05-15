package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Token struct {
	Address string
	Role    string
	Expiry  time.Time
}

func randomNonce(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func SignToken(t Token, secret string) string {
	payload := fmt.Sprintf("%s|%s|%d", strings.ToLower(t.Address), t.Role, t.Expiry.Unix())
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return base64.RawURLEncoding.EncodeToString([]byte(payload + "|" + sig))
}

func ParseAndVerify(token string, secret string) (Token, error) {
	raw, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return Token{}, err
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) != 4 {
		return Token{}, errors.New("invalid token")
	}
	addr := parts[0]
	role := parts[1]
	expUnix := parts[2]
	sig := parts[3]
	payload := strings.Join(parts[:3], "|")
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(payload))
	expected := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		return Token{}, errors.New("bad signature")
	}
	var exp int64
	_, err = fmt.Sscanf(expUnix, "%d", &exp)
	if err != nil {
		return Token{}, err
	}
	t := Token{Address: addr, Role: role, Expiry: time.Unix(exp, 0)}
	if time.Now().After(t.Expiry) {
		return Token{}, errors.New("expired")
	}
	return t, nil
}

// Nonce manager
type NonceProvider interface {
	New(address string) (string, error)
	Get(address string) (string, bool)
	Consume(address string)
}
