// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleRegistry {
    event ItemSet(bytes32 indexed key, bytes value, address indexed caller);

    mapping(bytes32 => bytes) private store;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function set(bytes32 key, bytes calldata value) external onlyOwner {
        store[key] = value;
        emit ItemSet(key, value, msg.sender);
    }

    function get(bytes32 key) external view returns (bytes memory) {
        return store[key];
    }
}


