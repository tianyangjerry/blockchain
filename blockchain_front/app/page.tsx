"use client";

import { useAuth } from "./context/AuthContext";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard");
  }, [isLoading, isAuthenticated, router]);
  return (
    <section className="relative overflow-hidden">
      {/* Background: black base */}
      <div className="absolute inset-0 -z-20 bg-[#0a0a0a]" />
      {/* Background: subtle grid */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "center top",
        }}
      />
      {/* Background: golden radial glow */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 -z-10 w-[70rem] h-[70rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(245,197,66,0.18), transparent 65%)" }} />

      <div className="relative max-w-7xl mx-auto px-4 animate-fade-in">
        {/* HERO - 募捐主题 */}
        <div className="py-20 sm:py-28 text-center text-white animate-slide-up">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs tracking-wide animate-fade-in">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#F5C542]" />
            公益透明 · 智能合约驱动
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold leading-tight tracking-tight">
            链上募捐，让每一份爱心
            <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent"> 透明可追溯</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm sm:text-base text-white/70 animate-fade-in" style={{ animationDelay: '.08s' }}>
            每一笔捐款都记录在区块链上，去中心化存证、防篡改、全流程公开。
            发起项目更简单，捐赠更安心。
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: '.12s' }}>
            <a
              href="/campaigns"
              className="inline-flex items-center justify-center rounded-md bg-[#F5C542] px-5 py-2 text-sm font-medium text-black transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F5C542] focus:ring-offset-black animate-glow"
            >
              我要捐赠
            </a>
            <a
              href="/register"
              className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-white/90 transition hover:border-[#F5C542]/60 hover:text-white"
            >
              发起项目
            </a>
          </div>

          {/* STATS - 募捐指标 */}
          <div className="mt-10 grid grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 animate-fade-in" style={{ animationDelay: '.06s' }}>
              <div className="text-xs text-white/60">已筹集善款</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">链上实时统计</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 animate-fade-in" style={{ animationDelay: '.12s' }}>
              <div className="text-xs text-white/60">参与捐赠者</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">去重地址计数</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 animate-fade-in" style={{ animationDelay: '.18s' }}>
              <div className="text-xs text-white/60">已完成项目</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">里程碑达成数</div>
            </div>
          </div>
        </div>

        {/* FEATURES - 核心价值 */}
        <div className="pb-20 sm:pb-28">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#F5C542]/50 hover:shadow-[0_10px_40px_-10px_rgba(245,197,66,0.25)] animate-slide-up" style={{ animationDelay: '.06s' }}>
              <div className="absolute inset-px pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(245,197,66,0.18), rgba(245,197,66,0.0))", opacity: 0.2 }} />
              <div className="text-sm text-white/60">链上透明</div>
              <div className="mt-2 text-lg font-semibold">每一笔捐赠可查可证</div>
              <p className="mt-2 text-sm text-white/60">捐赠记录上链存证，交易哈希与流向公开透明。</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#F5C542]/50 hover:shadow-[0_10px_40px_-10px_rgba(245,197,66,0.25)] animate-slide-up" style={{ animationDelay: '.12s' }}>
              <div className="absolute inset-px pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(245,197,66,0.18), rgba(245,197,66,0.0))", opacity: 0.2 }} />
              <div className="text-sm text-white/60">安全托管</div>
              <div className="mt-2 text-lg font-semibold">智能合约条件释放</div>
              <p className="mt-2 text-sm text-white/60">善款进入合约托管，仅在里程碑达成后自动释放。</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-[#F5C542]/50 hover:shadow-[0_10px_40px_-10px_rgba(245,197,66,0.25)] animate-slide-up" style={{ animationDelay: '.18s' }}>
              <div className="absolute inset-px pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(245,197,66,0.18), rgba(245,197,66,0.0))", opacity: 0.2 }} />
              <div className="text-sm text-white/60">公益激励</div>
              <div className="mt-2 text-lg font-semibold">捐赠徽章与奖励</div>
              <p className="mt-2 text-sm text-white/60">配置链上徽章与奖励规则，鼓励更多人参与与传播。</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
