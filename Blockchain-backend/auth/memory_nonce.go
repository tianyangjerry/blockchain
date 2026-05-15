package auth

import (
	"sync"
	"time"
)

type memoryNonce struct {
	mu sync.Mutex
	m  map[string]struct {
		Value  string
		Expiry time.Time
	}
}

func NewMemoryNonce() *memoryNonce {
	return &memoryNonce{m: map[string]struct {
		Value  string
		Expiry time.Time
	}{}}
}

func (n *memoryNonce) New(address string) (string, error) {
	n.mu.Lock()
	defer n.mu.Unlock()
	v, err := randomNonce(16)
	if err != nil {
		return "", err
	}
	n.m[address] = struct {
		Value  string
		Expiry time.Time
	}{Value: v, Expiry: time.Now().Add(5 * time.Minute)}
	return v, nil
}

func (n *memoryNonce) Get(address string) (string, bool) {
	n.mu.Lock()
	defer n.mu.Unlock()
	rec, ok := n.m[address]
	if !ok || time.Now().After(rec.Expiry) {
		return "", false
	}
	return rec.Value, true
}

func (n *memoryNonce) Consume(address string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	delete(n.m, address)
}
