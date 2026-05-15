"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, OrgApplication } from "../lib/api";
import { getAuthToken, withAuth } from "../lib/auth";

export default function OrgApproval() {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useQuery<OrgApplication[]>({
    queryKey: ["org-applications", "pending"],
    queryFn: async () => api.listOrgApplications("pending"),
    staleTime: 30000,
  });

  const act = async (address: string, status: "approved" | "rejected") => {
    const token = await getAuthToken("admin");
    const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/org/approve", withAuth({
      method: "POST",
      body: JSON.stringify({ address, status })
    }, token));
    if (!res.ok) {
      let msg = `HTTP ${res.status}`; try { const d = await res.json(); if ((d as any)?.error) msg = (d as any).error; } catch {}
      throw new Error(msg);
    }
    await qc.invalidateQueries({ queryKey: ["org-applications", "pending"] });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">机构审核</h2>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["org-applications", "pending"] })} className="px-3 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60">刷新</button>
      </div>
      {isLoading ? (
        <div className="mt-3 text-sm text-white/70">加载中...</div>
      ) : (
        <div className="mt-3 divide-y divide-white/10">
          {list.length === 0 && <div className="py-3 text-sm text-white/70">暂无待审核申请</div>}
          {list.map((o) => (
            <div key={o.address} className="py-3 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <div className="font-medium text-white truncate">{o.orgName} <span className="text-white/50">（{o.address}）</span></div>
                {o.docs && <div className="text-white/60 mt-0.5 break-all">资料：{o.docs}</div>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => act(o.address, "approved")} className="px-3 py-1 rounded-md bg-green-500/80 text-black text-xs">通过</button>
                <button onClick={() => act(o.address, "rejected")} className="px-3 py-1 rounded-md bg-red-500/80 text-black text-xs">驳回</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


