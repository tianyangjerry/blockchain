"use client";

import { useState } from "react";
import { getAuthToken, withAuth } from "../lib/auth";

export default function CampaignCreateForm({ onCreated }: { onCreated?: (id: string) => void }) {
  const [form, setForm] = useState({ id: "", title: "", description: "", goalAmount: "", image: "", beneficiary: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [ok, setOk] = useState(false);

  const onSubmit = async () => {
    setSaving(true); setError(undefined); setOk(false);
    try {
      if (!form.id || !form.title || !form.description || !form.goalAmount) throw new Error("请填写必填项");
      const token = await getAuthToken("admin");
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/campaigns", withAuth({
        method: "POST",
        body: JSON.stringify({ ...form })
      }, token));
      if (!res.ok) {
        let msg = `HTTP ${res.status}`; try { const d = await res.json(); if ((d as any)?.error) msg = (d as any).error; } catch {}
        throw new Error(msg);
      }
      setOk(true);
      onCreated?.(form.id);
      setForm({ id: "", title: "", description: "", goalAmount: "", image: "", beneficiary: "" });
    } catch (e: any) {
      setError(e?.message || "创建失败");
    } finally { setSaving(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">ID（唯一标识）</label>
        <input value={form.id} onChange={e=>setForm(v=>({ ...v, id: e.target.value }))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">标题</label>
        <input value={form.title} onChange={e=>setForm(v=>({ ...v, title: e.target.value }))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">描述</label>
        <textarea value={form.description} onChange={e=>setForm(v=>({ ...v, description: e.target.value }))} rows={3} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">目标金额（ETH）</label>
        <input value={form.goalAmount} onChange={e=>setForm(v=>({ ...v, goalAmount: e.target.value }))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">封面图 URL（可选）</label>
        <input value={form.image} onChange={e=>setForm(v=>({ ...v, image: e.target.value }))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>
      <div className="grid grid-cols-1 gap-1">
        <label className="text-sm">受益人地址（beneficiary）</label>
        <input value={form.beneficiary} onChange={e=>setForm(v=>({ ...v, beneficiary: e.target.value.toLowerCase() }))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button onClick={onSubmit} disabled={saving} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60">{saving ? "创建中..." : "创建项目"}</button>
        {ok && <span className="text-xs text-green-400">已创建</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}


