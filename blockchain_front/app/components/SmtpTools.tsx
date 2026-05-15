"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken, withAuth } from "../lib/auth";

export default function SmtpTools() {
  const { data: smtpStatus, refetch } = useQuery<{ status: string}>({
    queryKey: ["smtp-status"],
    queryFn: async () => {
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/email/status", { cache: "no-store" });
      return res.json();
    },
    staleTime: 30000,
  });
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState<string | undefined>(undefined);

  const onTest = async () => {
    setSending(true); setMsg(undefined);
    try {
      const token = await getAuthToken("admin");
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/email/test", withAuth({
        method: "POST",
        body: JSON.stringify({ to })
      }, token));
      if (!res.ok) {
        let m = `HTTP ${res.status}`; try { const d = await res.json(); if ((d as any)?.error) m = (d as any).error; } catch {}
        throw new Error(m);
      }
      setMsg("测试发送成功");
      refetch();
    } catch (e: any) {
      setMsg(e?.message || "发送失败");
    } finally { setSending(false); }
  };

  const isEnabled = smtpStatus?.status === 'enabled';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">邮件工具</h2>
        <span className={`text-xs px-2 py-0.5 rounded-md border ${isEnabled ? 'border-green-500/30 text-green-400' : 'border-white/15 text-white/60'}`}>{smtpStatus?.status || 'unknown'}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
        <input placeholder="收件人邮箱" value={to} onChange={(e)=>setTo(e.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
        <button onClick={onTest} disabled={sending || !emailOk || !isEnabled} className="w-fit px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60 disabled:opacity-60">{sending ? "发送中..." : "发送测试邮件"}</button>
        {(!emailOk && to) && <span className="text-xs text-red-400">邮箱格式不正确</span>}
        {msg && <span className={`text-xs ${msg.includes('成功') ? 'text-green-400' : 'text-red-400'}`}>{msg}</span>}
      </div>
    </div>
  );
}


