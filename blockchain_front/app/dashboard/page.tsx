"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import ContractList from "../components/ContractList";
import { api, ContractRecord } from "../lib/api";

function DashboardPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: items = [], isLoading: isListLoading } = useQuery<ContractRecord[]>({
    queryKey: ["contracts"],
    queryFn: async () => {
      const list = await api.listContracts();
      return Array.isArray(list) ? list : [];
    },
    staleTime: 30000,
    retry: 1,
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login");
  }, [isLoading, isAuthenticated, router]);

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[#0a0a0a]" />
      <div
        className="absolute inset-0 -z-10 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          backgroundPosition: "center top",
        }}
      />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 -z-10 w-[70rem] h-[70rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(245,197,66,0.18), transparent 65%)" }} />

      {(isLoading || isListLoading) ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)] text-white">
          <div className="text-center animate-fade-in">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto"></div>
            <p className="mt-2 text-sm text-white/70">加载中...</p>
          </div>
        </div>
      ) : (
        <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
          <div className="mb-6 animate-slide-up">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">用户仪表板</span>
            </h1>
            <p className="text-sm text-white/70 mt-1">查看和操作现有合约</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <ContractList items={items.map(r => ({ name: r.name, address: r.address, network: r.network }))} onSelect={setSelected} />
          </div>

          {selected && (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-white/80">已选择合约：<span className="text-white">{selected}</span></p>
              <div className="mt-3 flex gap-2">
                <a href={`/contracts/${selected}`} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95">查看详情</a>
                <button className="px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60" onClick={() => navigator.clipboard?.writeText(selected)}>复制地址</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// 页面已废弃：返回 404
export default dynamic(() => Promise.resolve(() => null), { ssr: false });


