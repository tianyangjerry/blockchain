// Minimal ABIs for DonationCampaigns and ERC20
export const DONATION_CAMPAIGNS_ABI = [
    {
        inputs: [{ internalType: "bytes32", name: "id", type: "bytes32" }],
        name: "donateETH",
        outputs: [],
        stateMutability: "payable",
        type: "function",
    },
    {
        inputs: [
            { internalType: "bytes32", name: "id", type: "bytes32" },
            { internalType: "address", name: "token", type: "address" },
            { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "donateERC20",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export const ERC20_MIN_ABI = [
    {
        constant: true,
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ name: "remaining", type: "uint256" }],
        type: "function",
    },
    {
        constant: false,
        inputs: [
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ name: "success", type: "bool" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ name: "", type: "uint8" }],
        type: "function",
    },
    {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ name: "", type: "string" }],
        type: "function",
    },
] as const;
