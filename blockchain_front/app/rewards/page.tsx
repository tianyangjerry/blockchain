"use client";

import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { api, LeaderboardEntry } from "../lib/api";
import { useAuth } from "../context/AuthContext";

function RewardsPageInner() {
  const { user, isAuthenticated } = useAuth();
  const { data: list = [], isLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: api.getLeaderboard,
    staleTime: 60000,
    placeholderData: [],
    select: (d) => Array.isArray(d) ? d : [],
  });
  const { data: myBadges } = useQuery<any>({
    queryKey: ["badges", user?.address || ""],
    queryFn: async () => user?.address ? api.getBadges(user.address) : null,
    enabled: !!user?.address,
    staleTime: 30000,
  });

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

      <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
        <div className="mb-6 animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">奖励与排行榜</span>
          </h1>
          <p className="text-sm text-white/70 mt-1">查看捐赠排行榜，了解你的积分与徽章</p>
        </div>

        {isAuthenticated && myBadges && (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
            <h2 className="text-lg font-semibold">我的成就</h2>
            <div className="mt-2 text-sm text-white/80">累计捐赠：{myBadges.totalEth} ETH · 积分：{myBadges.totalPoints}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(myBadges.badges || []).length === 0 && (
                <span className="text-xs text-white/60">暂无徽章</span>
              )}
              {(myBadges.badges || []).map((b: string) => (
                <span key={b} className="px-2 py-1 rounded-md border border-white/10 bg-white/[0.04] text-xs capitalize">{b}</span>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <h2 className="text-lg font-semibold">捐赠排行榜</h2>
          {isLoading ? (
            <div className="mt-4 text-sm text-white/70">加载中...</div>
          ) : (
            <div className="mt-3 divide-y divide-white/10">
              { list.length === 0 && <div className="py-3 text-sm text白/70">暂无数据</div> }
              { list.map((it, idx) => (
                <div key={it.donor + idx} className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-white/60">#{idx + 1}</span>
                    <span className="text-white/80">{it.donor}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-white">{it.totalEth} ETH</span>
                    <span className="text-white/80 text-xs">{it.totalPoints} 分</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default dynamic(() => Promise.resolve(RewardsPageInner), { ssr: false });


