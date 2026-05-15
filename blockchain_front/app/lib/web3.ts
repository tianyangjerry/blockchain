"use client";

import Web3 from "web3";

export function getWeb3(): Web3 {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const w = new Web3((window as any).ethereum);
    return w;
  }
  const rpc = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8545";
  return new Web3(new Web3.providers.HttpProvider(rpc));
}

export async function ensureAccounts(): Promise<string[]> {
  if (typeof window === "undefined") return [];
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("未检测到钱包 (window.ethereum)");
  const accounts = await eth.request({ method: "eth_requestAccounts" });
  return accounts as string[];
}


