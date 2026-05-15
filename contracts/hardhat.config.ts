import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 200 } },
    },
    paths: {
        sources: "src",
        tests: "test",
        cache: "cache",
        artifacts: "artifacts",
    },
    networks: {
        // Fallback RPC to npm mirror's default-friendly address if env missing
        localhost: { url: process.env.RPC_URL || "http://127.0.0.1:8545" },
        sepolia: {
            url: process.env.SEPOLIA_RPC || "",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
};

export default config;
