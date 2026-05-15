"use client";

import { ensureAccounts } from "./web3";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export async function getAuthToken(
    desiredRole?: "admin" | "user",
    isRegistration?: boolean
): Promise<string> {
    const accounts = await ensureAccounts();
    const address = accounts[0];
    // 1) 获取 nonce
    const nonceRes = await fetch(`${API_BASE}/api/auth/nonce`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
    });
    const { nonce } = await nonceRes.json();
    // 2) 让钱包签名
    const eth = (window as any).ethereum;
    const signature = await eth.request({
        method: "personal_sign",
        params: [`Login:${nonce}`, address],
    });
    // 3) 交换 token
    const verifyRes = await fetch(`${API_BASE}/api/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            address,
            signature,
            role: desiredRole || "user",
            isRegistration: isRegistration ? "true" : "false",
        }),
    });
    if (!verifyRes.ok) throw new Error(`Auth failed: ${verifyRes.status}`);
    const { token } = await verifyRes.json();
    return token as string;
}

export function withAuth(init?: RequestInit, token?: string): RequestInit {
    return {
        ...(init || {}),
        headers: {
            "Content-Type": "application/json",
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    };
}
