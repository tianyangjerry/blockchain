"use client";

import { useState, useEffect } from "react";

export interface WalletInfo {
  name: string;
  icon: string;
  isInstalled: boolean;
  connect: () => Promise<string[]>;
}

export interface WalletVerificationProps {
  onSuccess: (address: string) => void;
  onError: (error: string) => void;
  loading?: boolean;
}

export default function WalletVerification({ onSuccess, onError, loading = false }: WalletVerificationProps) {
  const [availableWallets, setAvailableWallets] = useState<WalletInfo[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    // 检测可用的钱包
    const wallets: WalletInfo[] = [
      {
        name: "MetaMask",
        icon: "🦊",
        isInstalled: !!(typeof window !== "undefined" && (window as any).ethereum?.isMetaMask),
        connect: async () => {
          const eth = (window as any).ethereum;
          if (!eth) throw new Error("MetaMask not installed");
          return await eth.request({ method: "eth_requestAccounts" });
        }
      },
      {
        name: "WalletConnect",
        icon: "🔗",
        isInstalled: !!(typeof window !== "undefined" && (window as any).ethereum?.isWalletConnect),
        connect: async () => {
          const eth = (window as any).ethereum;
          if (!eth) throw new Error("WalletConnect not available");
          return await eth.request({ method: "eth_requestAccounts" });
        }
      },
      {
        name: "Coinbase Wallet",
        icon: "🔵",
        isInstalled: !!(typeof window !== "undefined" && (window as any).ethereum?.isCoinbaseWallet),
        connect: async () => {
          const eth = (window as any).ethereum;
          if (!eth) throw new Error("Coinbase Wallet not installed");
          return await eth.request({ method: "eth_requestAccounts" });
        }
      }
    ];

    setAvailableWallets(wallets);
    // 默认选择第一个已安装的钱包
    const firstInstalled = wallets.find(w => w.isInstalled);
    if (firstInstalled) {
      setSelectedWallet(firstInstalled);
    }
  }, []);

  const handleConnect = async () => {
    if (!selectedWallet) {
      onError("请选择一个钱包");
      return;
    }

    setConnecting(true);
    try {
      const accounts = await selectedWallet.connect();
      if (accounts && accounts.length > 0) {
        onSuccess(accounts[0]);
      } else {
        onError("未获取到钱包地址");
      }
    } catch (error: any) {
      let errorMessage = "钱包连接失败";
      
      if (error.message.includes("User rejected")) {
        errorMessage = "用户取消了钱包连接";
      } else if (error.message.includes("not installed")) {
        errorMessage = `${selectedWallet.name} 未安装，请先安装钱包`;
      } else if (error.message.includes("No Ethereum provider")) {
        errorMessage = "未检测到以太坊钱包，请安装 MetaMask 或其他钱包";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      onError(errorMessage);
    } finally {
      setConnecting(false);
    }
  };

  if (loading || connecting) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">
          {connecting ? "连接钱包中..." : "处理中..."}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600 mb-4">
        选择您的钱包进行连接和验证
      </div>
      
      <div className="space-y-2">
        {availableWallets.map((wallet) => (
          <label
            key={wallet.name}
            className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedWallet?.name === wallet.name
                ? "border-blue-500 bg-blue-50"
                : wallet.isInstalled
                ? "border-gray-200 hover:border-gray-300"
                : "border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed"
            }`}
          >
            <input
              type="radio"
              name="wallet"
              value={wallet.name}
              checked={selectedWallet?.name === wallet.name}
              onChange={() => setSelectedWallet(wallet)}
              disabled={!wallet.isInstalled}
              className="sr-only"
            />
            <span className="text-2xl mr-3">{wallet.icon}</span>
            <div className="flex-1">
              <div className="font-medium">{wallet.name}</div>
              <div className="text-sm text-gray-500">
                {wallet.isInstalled ? "已安装" : "未安装"}
              </div>
            </div>
            {!wallet.isInstalled && (
              <a
                href={`https://${wallet.name.toLowerCase().replace(" ", "")}.io/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-800"
                onClick={(e) => e.stopPropagation()}
              >
                安装
              </a>
            )}
          </label>
        ))}
      </div>

      <button
        onClick={handleConnect}
        disabled={!selectedWallet?.isInstalled}
        className="w-full py-2 px-4 rounded-md bg-blue-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
      >
        连接 {selectedWallet?.name || "钱包"}
      </button>
    </div>
  );
}
