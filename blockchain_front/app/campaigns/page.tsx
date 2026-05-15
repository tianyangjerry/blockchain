"use client";

import { useQuery } from "@tanstack/react-query";
import { api, Campaign } from "../lib/api";
import CampaignCard from "../components/CampaignCard";

function CampaignsPage() {
  const { data: items = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["campaigns"],
    queryFn: async () => {
      try {
        const list = await api.listCampaigns();
        return Array.isArray(list) ? list : [];
      } catch {
        // 后端未就绪时的占位数据
        return [
          {
            id: "demo-1",
            title: "为山区学校筹建图书角",
            description: "帮助孩子们拥有更多阅读资源，点亮求知之灯。",
            goalAmount: "100",
            raisedAmount: "32.5",
            status: "active",
            image: "/globe.svg",
          },
          {
            id: "demo-2",
            title: "关爱流浪动物医疗基金",
            description: "为受伤与患病的流浪动物提供基本治疗与康复。",
            goalAmount: "80",
            raisedAmount: "54.2",
            status: "active",
            image: "/window.svg",
          },
        ];
      }
    },
    staleTime: 30000,
    retry: 0,
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
            <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">募捐项目</span>
          </h1>
          <p className="text-sm text-white/70 mt-1">浏览并参与爱心募捐</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl border border-white/10 bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <CampaignCard key={it.id} item={it} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default CampaignsPage;


