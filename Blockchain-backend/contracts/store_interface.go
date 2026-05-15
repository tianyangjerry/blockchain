package contracts

type ContractStore interface {
	List() ([]ContractRecord, error)
	Get(address string) (ContractRecord, bool)
	Put(r ContractRecord) error
}
