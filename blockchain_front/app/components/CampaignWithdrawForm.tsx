"use client";

import { useState } from "react";
import { getAuthToken, withAuth } from "../lib/auth";

export default function CampaignWithdrawForm({ id, onDone }: { id: string; onDone?: () => void }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [ok, setOk] = useState(false);

  const onSubmit = async () => {
    setSaving(true); setError(undefined); setOk(false);
    try {
      if (!amount) throw new Error("请输入金额");
      const token = await getAuthToken("admin");
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + `/api/campaigns/${id}/withdraw`, withAuth({
        method: "POST",
        body: JSON.stringify({ amount })
      }, token));
      if (!res.ok) {
        let msg = `HTTP ${res.status}`; try { const d = await res.json(); if ((d as any)?.error) msg = (d as any).error; } catch {}
        throw new Error(msg);
      }
      setOk(true);
      setAmount("");
      onDone?.();
    } catch (e: any) {
      setError(e?.message || "操作失败");
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      <label className="text-sm">提现金额（ETH）</label>
      <input value={amount} onChange={(e)=>setAmount(e.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      <div className="flex items-center gap-2">
        <button onClick={onSubmit} disabled={saving} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60">{saving ? "处理中..." : "提现"}</button>
        {ok && <span className="text-xs text-green-400">已提交</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}


