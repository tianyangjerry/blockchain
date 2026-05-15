"use client";

import { useState } from "react";
import { getAuthToken, withAuth } from "../lib/auth";

export default function PerfTools() {
  const [campaigns, setCampaigns] = useState(0);
  const [donations, setDonations] = useState(0);
  const [withdrawals, setWithdrawals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | undefined>(undefined);

  const run = async () => {
    setBusy(true);
    setMsg(undefined);
    try {
      const token = await getAuthToken("admin");
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/admin/perf/bulk", withAuth({
        method: "POST",
        body: JSON.stringify({ campaigns, donations, withdrawals })
      }, token));
      if (!res.ok) {
        let text = `HTTP ${res.status}`;
        try { const d = await res.json(); if ((d as any)?.error) text = (d as any).error; } catch {}
        throw new Error(text);
      }
      const data = await res.json();
      setMsg(`OK: 新增项目=${data.campaigns}, 捐赠=${data.donations}, 提现=${data.withdrawals}`);
    } catch (e: any) {
      setMsg(e?.message || "执行失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-3">性能造数工具（管理员）</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-white/70">新增项目数量</label>
          <input type="number" min={0} value={campaigns}
                 onChange={e => setCampaigns(parseInt(e.target.value || "0", 10))}
                 className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
        </div>
        <div>
          <label className="text-sm text-white/70">新增捐赠数量</label>
          <input type="number" min={0} value={donations}
                 onChange={e => setDonations(parseInt(e.target.value || "0", 10))}
                 className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={withdrawals} onChange={e => setWithdrawals(e.target.checked)} />
            生成提现
          </label>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button onClick={run} disabled={busy} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60">
          {busy ? "执行中..." : "执行造数"}
        </button>
        {msg && <span className="text-xs text-white/80">{msg}</span>}
      </div>
      <div className="mt-2 text-xs text-white/60">提示：此操作会直接写入数据库，影响统计与排行榜。</div>
    </div>
  );
}


