"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, Donation } from "../lib/api";

function MyDonationsInner() {
  const { user, isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const pageSize = 20;

  const { data: items = [], isLoading, refetch } = useQuery<Donation[]>({
    queryKey: ["my-donations", user?.address, page, from, to],
    queryFn: async () => {
      if (!user?.address) return [];
      return api.queryDonations({ address: user.address, page, pageSize, from: from || undefined, to: to || undefined });
    },
    enabled: !!user?.address,
    staleTime: 15000,
    placeholderData: [],
    select: (d) => Array.isArray(d) ? d : [],
  });

  const exportCsv = () => {
    const header = ["id","campaignId","donor","amount","token","txHash","timestamp"];
    const rows = items.map(d => [d.id, d.campaignId, d.donor, d.amount, d.token || "", d.txHash || "", d.timestamp]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v || "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `my-donations-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[#0a0a0a]" />
      <div className="absolute inset-0 -z-10 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", backgroundPosition: "center top" }} />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 -z-10 w-[70rem] h-[70rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(245,197,66,0.18), transparent 65%)" }} />

      <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
        <div className="mb-6 animate-slide-up flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight"><span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">我的捐赠</span></h1>
            <p className="text-sm text-white/70 mt-1">筛选、分页、导出 CSV</p>
          </div>
          <button onClick={exportCsv} disabled={!items.length} className="px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60 disabled:opacity-60">导出 CSV</button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <label className="text-xs text-white/60">开始时间 (RFC3339)</label>
              <input value={from} onChange={(e)=>setFrom(e.target.value)} placeholder="2025-01-01T00:00:00Z" className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-[#F5C542]/60" />
            </div>
            <div>
              <label className="text-xs text-white/60">结束时间 (RFC3339)</label>
              <input value={to} onChange={(e)=>setTo(e.target.value)} placeholder="2025-12-31T23:59:59Z" className="mt-1 w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 outline-none focus:border-[#F5C542]/60" />
            </div>
            <div className="flex items-end">
              <button onClick={()=>{ setPage(1); refetch(); }} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm">筛选</button>
            </div>
          </div>

          <div className="mt-4 divide-y divide-white/10">
            {isLoading ? (
              <div className="py-6 text-white/70">加载中...</div>
            ) : (
              items.length === 0 ? (
                <div className="py-6 text-white/70">暂无数据</div>
              ) : (
                items.map(d => (
                  <div key={d.id} className="py-3 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="text-white/90">项目：{d.campaignId}</div>
                      <div className="text-white/60 mt-0.5 break-all">金额：{d.amount} {d.token || "ETH"} · Tx：{d.txHash || "-"}</div>
                    </div>
                    <div className="text-white/60 text-xs">{d.timestamp}</div>
                  </div>
                ))
              )
            )}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] disabled:opacity-60">上一页</button>
            <span className="text-white/70">第 {page} 页</span>
            <button disabled={!items.length || items.length < pageSize} onClick={()=>setPage(p=>p+1)} className="px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] disabled:opacity-60">下一页</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default dynamic(() => Promise.resolve(MyDonationsInner), { ssr: false });


