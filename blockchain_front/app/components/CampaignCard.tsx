"use client";

import Link from "next/link";
import { Campaign } from "../lib/api";

export default function CampaignCard({ item }: { item: Campaign }) {
  const goal = parseFloat(item.goalAmount || "0");
  const raised = parseFloat(item.raisedAmount || "0");
  const ratio = goal > 0 ? Math.min(raised / goal, 1) : 0;
  const percent = Math.round(ratio * 100);
  const completed = item.status === "completed" || (goal > 0 && raised >= goal);
  const now = new Date();
  const startAt = item.startAt ? new Date(item.startAt) : undefined as any;
  const endAt = item.endAt ? new Date(item.endAt) : undefined as any;
  const notStarted = startAt && now < startAt;
  const ended = endAt && now > endAt;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-[#F5C542]/50 hover:shadow-[0_10px_40px_-10px_rgba(245,197,66,0.25)]">
      {item.image && (
        <div className="mb-3 aspect-[16/9] w-full overflow-hidden rounded-lg bg-white/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base sm:text-lg font-semibold tracking-tight text-white">
          {item.title}
        </h3>
        <span className={`text-[10px] rounded-md border px-2 py-0.5 ${completed ? "border-emerald-500 text-emerald-400" : "border-white/10 text-white/70"}`}>
          {ended ? "已结束" : notStarted ? "未开始" : (completed ? "已完成" : "进行中")}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-white/70">{item.description}</p>

      <div className="mt-3">
        <div className={`h-2 w-full overflow-hidden rounded-full ${completed ? 'bg-emerald-900/40' : 'bg-white/10'}`}>
          <div
            className={`h-full ${completed ? 'bg-emerald-400' : 'bg-[#F5C542]'}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-white/70">
          <span className={`${completed ? 'text-emerald-400' : ''}`}>已筹 {raised}</span>
          <span>目标 {goal}</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/campaigns/${item.id}`}
          className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95"
        >
          查看详情
        </Link>
      </div>
    </div>
  );
}


