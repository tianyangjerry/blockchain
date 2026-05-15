"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout, balanceEth } = useAuth();

  const NavLink: React.FC<{ href: string; label: string }> = ({ href, label }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`px-3 py-1 rounded-md transition-colors ${active ? "bg-foreground text-background" : "hover:bg-black/10 dark:hover:bg-white/10"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header className="w-full sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-black/10 dark:border-white/10">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">链上募捐</Link>
        <nav className="flex items-center gap-2 text-sm">
          {!isAuthenticated && (
            <>
              <NavLink href="/" label="首页" />
              <NavLink href="/campaigns" label="募捐项目" />
              <NavLink href="/rewards" label="奖励" />
              <NavLink href="/login" label="登录" />
              <NavLink href="/register" label="注册" />
            </>
          )}
          {isAuthenticated && (
            <>
              {/* 登录后隐藏首页按钮，仅显示仪表板/管理员 */}
              <NavLink href="/campaigns" label="募捐项目" />
              <NavLink href="/rewards" label="奖励" />
              <NavLink href="/my-donations" label="我的捐赠" />
              {/* 仪表板入口全局移除 */}
              {user?.role === "admin" && <NavLink href="/admin" label="管理员" />}
              <span className="px-2 py-1 rounded-md border">{user?.role === "admin" ? "管理员" : "用户"} · {user?.address?.slice(0,6)}...{user?.address?.slice(-4)}</span>
              {balanceEth && <span className="px-2 py-1 rounded-md border">余额：{parseFloat(balanceEth).toFixed(4)} ETH</span>}
              <button onClick={logout} className="ml-2 px-3 py-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10">退出</button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}


