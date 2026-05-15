"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function ConnectWallet() {
  const { isAuthenticated, loginWithWallet } = useAuth();
  const [loading, setLoading] = useState(false);
  const hasEthereum = typeof window !== "undefined" && (window as any).ethereum;

  const onConnect = async () => {
    setLoading(true);
    try {
      await loginWithWallet();
    } catch (e) {
      // noop; error will be surfaced via wallet UI typically
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="ml-2">
      {hasEthereum ? (
        <button onClick={onConnect} disabled={loading} className="px-3 py-1 rounded-md bg-foreground text-background disabled:opacity-60">
          {loading ? "连接中..." : "连接钱包"}
        </button>
      ) : (
        <a href="https://metamask.io/" target="_blank" rel="noreferrer" className="px-3 py-1 rounded-md border">安装钱包</a>
      )}
    </div>
  );
}


