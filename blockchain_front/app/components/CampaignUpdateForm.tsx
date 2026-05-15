"use client";

import { useState } from "react";
import { getAuthToken, withAuth } from "../lib/auth";

export default function CampaignUpdateForm({ campaignId, onPosted }: { campaignId: string; onPosted?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | undefined>(undefined);

  const onSubmit = async () => {
    if (!content.trim()) return;
    setLoading(true); setMsg(undefined);
    try {
      const token = await getAuthToken(); // org 或 admin 均可
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + `/api/campaigns/${campaignId}/updates`, withAuth({
        method: "POST",
        body: JSON.stringify({ content })
      }, token));
      if (!res.ok) {
        let m = `HTTP ${res.status}`; try { const d = await res.json(); if ((d as any)?.error) m = (d as any).error; } catch {}
        throw new Error(m);
      }
      setContent("");
      setMsg("已发布");
      onPosted?.();
    } catch (e: any) {
      setMsg(e?.message || "发布失败");
    } finally { setLoading(false); }
  };

  return (
    <div className="grid grid-cols-1 gap-2">
      <textarea rows={3} placeholder="发布项目进展..." value={content} onChange={(e)=>setContent(e.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      <div className="flex items-center gap-2">
        <button onClick={onSubmit} disabled={loading || !content.trim()} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60">{loading ? "发布中..." : "发布更新"}</button>
        {msg && <span className="text-xs text-white/70">{msg}</span>}
      </div>
    </div>
  );
}


