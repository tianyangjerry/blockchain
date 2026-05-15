package contracts

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Store struct {
	mu       sync.RWMutex
	filePath string
	byAddr   map[string]ContractRecord
}

func NewStore(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	s := &Store{filePath: filepath.Join(dataDir, "contracts.json"), byAddr: map[string]ContractRecord{}}
	_ = s.load()
	return s, nil
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	f, err := os.Open(s.filePath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	defer f.Close()
	dec := json.NewDecoder(f)
	var arr []ContractRecord
	if err := dec.Decode(&arr); err != nil {
		return err
	}
	for _, r := range arr {
		s.byAddr[normalize(r.Address)] = r
	}
	return nil
}

func (s *Store) persist() error {
	tmp := filepath.Join(filepath.Dir(s.filePath), "contracts.tmp.json")
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	s.mu.RLock()
	var arr []ContractRecord
	for _, r := range s.byAddr {
		arr = append(arr, r)
	}
	s.mu.RUnlock()
	enc := json.NewEncoder(f)
	enc.SetIndent("", "  ")
	if err := enc.Encode(arr); err != nil {
		_ = f.Close()
		_ = os.Remove(tmp)
		return err
	}
	_ = f.Close()
	return os.Rename(tmp, s.filePath)
}

func normalize(addr string) string {
	if len(addr) >= 2 && addr[:2] == "0x" {
		return addr
	}
	return addr
}

func (s *Store) List() ([]ContractRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]ContractRecord, 0, len(s.byAddr))
	for _, r := range s.byAddr {
		out = append(out, r)
	}
	return out, nil
}

func (s *Store) Get(address string) (ContractRecord, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	r, ok := s.byAddr[normalize(address)]
	return r, ok
}

func (s *Store) Put(r ContractRecord) error {
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now()
	}
	s.mu.Lock()
	s.byAddr[normalize(r.Address)] = r
	s.mu.Unlock()
	return s.persist()
}
