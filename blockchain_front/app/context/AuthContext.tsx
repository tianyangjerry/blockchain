"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ensureAccounts, getWeb3 } from "../lib/web3";
import { getAuthToken } from "../lib/auth";

export type UserRole = "admin" | "user";

export interface AuthUser {
  address: string;
  role: UserRole;
  token: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithWallet: (role?: UserRole, isRegistration?: boolean) => Promise<void>;
  logout: () => void;
  balanceEth?: string;
}

const STORAGE_KEY = "blockchain_auth_user_v1";

function parseRoleFromToken(token: string): UserRole | "unknown" {
  try {
    // 我们后端的 token 是 base64(payload|sig)，这里只做轻量解析，不做校验
    const raw = atob(token);
    const parts = raw.split("|");
    // payload: address|role|expUnix
    if (parts.length >= 3) {
      const payload = parts.slice(0, 3);
      const role = payload[1];
      if (role === "admin" || role === "user") return role as UserRole;
    }
  } catch {}
  return "unknown" as any;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [balanceEth, setBalanceEth] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as AuthUser;
        setUser(parsed);
      }
    } catch {
      // ignore malformed localStorage
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (user) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [user]);

  const loginWithWallet = useCallback(async (role?: UserRole, isRegistration?: boolean) => {
    const accounts = await ensureAccounts();
    if (!accounts?.length) throw new Error("未检测到账户");
    const address = (accounts[0] as string).toLowerCase();
    const token = await getAuthToken(role ?? "user", isRegistration);
    const realRole = parseRoleFromToken(token);
    const nextUser: AuthUser = { address, role: (realRole === "unknown" ? (role ?? "user") : realRole) as UserRole, token };
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        if (!user) { setBalanceEth(undefined); return; }
        const web3 = getWeb3();
        const balWei = await web3.eth.getBalance(user.address);
        const bal = web3.utils.fromWei(balWei, "ether");
        setBalanceEth(bal);
      } catch {}
    })();
  }, [user]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    loginWithWallet,
    logout,
    balanceEth,
  }), [user, isLoading, loginWithWallet, logout, balanceEth]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};


