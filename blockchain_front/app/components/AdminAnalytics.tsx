\"use client\";

import { useEffect, useState } from \"react\";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || \"http://localhost:8080\";

export default function AdminAnalytics() {
  const [days] = useState(30);
  const [gasSeries, setGasSeries] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [topTxs, setTopTxs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [g, m, c, t] = await Promise.all([
          fetch(`${API_BASE}/api/analytics/gas?days=${days}`).then(r => r.json()),
          fetch(`${API_BASE}/api/analytics/methods?days=${days}&limit=10`).then(r => r.json()),
          fetch(`${API_BASE}/api/analytics/campaigns?days=${days}&limit=10`).then(r => r.json()),
          fetch(`${API_BASE}/api/analytics/top?limit=10`).then(r => r.json()),
        ]);
        setGasSeries(Array.isArray(g) ? g : []);
        setMethods(Array.isArray(m) ? m : []);
        setCampaigns(Array.isArray(c) ? c : []);
        setTopTxs(Array.isArray(t) ? t : []);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  return (
    <div className=\"rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6\">
      <h2 className=\"text-lg font-semibold mb-3\">Gas 指标（过去 {days} 天）</h2>
      <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-4\">
        <div className=\"p-3 bg-black/20 rounded\">
          <h3 className=\"text-sm text-white/80 mb-2\">总 Gas（按日）</h3>
          {loading ? <div className=\"text-sm text-white/60\">加载中...</div> : (
            <div className=\"text-xs text-white/70 max-h-48 overflow-auto\">
              <table className=\"w-full text-left text-xs\">
                <thead>
                  <tr><th>日期</th><th className=\"text-right\">总 Gas</th><th className=\"text-right\">笔数</th></tr>
                </thead>
                <tbody>
                  {gasSeries.map((d: any) => (
                    <tr key={d.day}><td>{d.day}</td><td className=\"text-right\">{d.total_gas}</td><td className=\"text-right\">{d.tx_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className=\"p-3 bg-black/20 rounded\">
          <h3 className=\"text-sm text-white/80 mb-2\">按方法分布（Top 10）</h3>
          {loading ? <div className=\"text-sm text-white/60\">加载中...</div> : (
            <div className=\"text-xs text-white/70 max-h-48 overflow-auto\">
              <table className=\"w-full text-left text-xs\">
                <thead>
                  <tr><th>方法</th><th className=\"text-right\">笔数</th><th className=\"text-right\">avg</th><th className=\"text-right\">p50</th><th className=\"text-right\">p95</th></tr>
                </thead>
                <tbody>
                  {methods.map((m: any) => (
                    <tr key={m.method}><td>{m.method}</td><td className=\"text-right\">{m.tx_count}</td><td className=\"text-right\">{m.avg_gas}</td><td className=\"text-right\">{m.p50}</td><td className=\"text-right\">{m.p95}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className=\"p-3 bg-black/20 rounded\">
          <h3 className=\"text-sm text-white/80 mb-2\">按 Campaign 聚合（Top 10）</h3>
          {loading ? <div className=\"text-sm text-white/60\">加载中...</div> : (
            <div className=\"text-xs text-white/70 max-h-48 overflow-auto\">
              <table className=\"w-full text-left text-xs\">
                <thead>
                  <tr><th>Campaign</th><th className=\"text-right\">总 Gas</th><th className=\"text-right\">avg Gas</th><th className=\"text-right\">笔数</th></tr>
                </thead>
                <tbody>
                  {campaigns.map((c: any) => (
                    <tr key={c.campaign_id}><td>{c.campaign_id}</td><td className=\"text-right\">{c.total_gas}</td><td className=\"text-right\">{c.avg_gas}</td><td className=\"text-right\">{c.tx_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className=\"p-3 bg-black/20 rounded\">
          <h3 className=\"text-sm text-white/80 mb-2\">Top 高耗交易</h3>
          {loading ? <div className=\"text-sm text-white/60\">加载中...</div> : (
            <div className=\"text-xs text-white/70 max-h-48 overflow-auto\">
              <table className=\"w-full text-left text-xs\">
                <thead>
                  <tr><th>Tx</th><th className=\"text-right\">方法</th><th className=\"text-right\">Gas</th><th className=\"text-right\">手续费(ETH)</th></tr>
                </thead>
                <tbody>
                  {topTxs.map((t: any) => (
                    <tr key={t.tx_hash}><td className=\"truncate max-w-[10rem]\"><a className=\"text-[#F5C542]\" href=\"#\" onClick={(e)=>e.preventDefault()}>{t.tx_hash}</a></td><td className=\"text-right\">{t.method}</td><td className=\"text-right\">{t.gas_used}</td><td className=\"text-right\">{t.tx_fee_eth}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, AnalyticsSummary, DailyPoint } from "../lib/api";

export default function AdminAnalytics() {
  const { data } = useQuery<AnalyticsSummary>({
    queryKey: ["analytics-summary"],
    queryFn: api.getAnalyticsSummary,
    staleTime: 30000,
  });
  const { data: daily = [] } = useQuery<DailyPoint[]>({
    queryKey: ["analytics-daily", 30],
    queryFn: () => api.getAnalyticsDaily(30),
    staleTime: 30000,
    placeholderData: [],
    select: (d) => Array.isArray(d) ? d : [],
  });
  const { data: topProjects = [] } = useQuery<{ key: string; total: string }[]>({
    queryKey: ["analytics-top", "campaign", 5],
    queryFn: () => api.getAnalyticsTop("campaign", 5),
    staleTime: 30000,
    placeholderData: [],
    select: (d) => Array.isArray(d) ? d : [],
  });
  const { data: gas } = useQuery<any>({
    queryKey: ["analytics-gas", 30],
    queryFn: () => api.getAnalyticsGas(30),
    staleTime: 30000,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">数据分析</h2>
        <button className="px-3 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60"
          onClick={() => window.location.reload()}>刷新</button>
      </div>
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPI label="总金额 (ETH)" value={data?.totalAmount || "0"} />
        <KPI label="总捐赠笔数" value={String(data?.totalDonations ?? 0)} />
        <KPI label="项目总数" value={String(data?.totalCampaigns ?? 0)} />
        <KPI label="活跃项目" value={String(data?.activeCampaigns ?? 0)} />
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MiniLineChart title="近30天捐赠金额(ETH)" points={daily.map(d=>({ x: d.date, y: parseFloat(d.amount) }))} />
        <MiniList title="Top 项目 (按金额)" items={topProjects.map(t=>({ label: t.key, value: t.total }))} />
      </div>
      <div className="mt-4 text-xs text-white/60">Gas (样本 {gas?.sample || 0}) · 平均 GasUsed {gas?.avgGasUsed || 0} · 平均 GasPrice {gas?.avgGasPriceGwei || 0} gwei · 平均手续费 {gas?.avgFeeETH || 0} ETH</div>
    </div>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-lg font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function MiniLineChart({ title, points }: { title: string; points: { x: string; y: number }[] }) {
  const maxY = useMemo(() => Math.max(1, ...points.map(p => p.y)), [points]);
  const path = useMemo(() => {
    if (!points.length) return "";
    const w = 280, h = 80, pad = 6;
    const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
    const scaleY = (v: number) => h - pad - (v / maxY) * (h - pad * 2);
    let d = "";
    points.forEach((p, i) => {
      const x = pad + i * step;
      const y = scaleY(p.y);
      d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });
    return d;
  }, [points, maxY]);
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs text-white/60 mb-2">{title}</div>
      <svg width={280} height={80}>
        <path d={path} stroke="#F5C542" fill="none" strokeWidth={2} />
      </svg>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="text-xs text-white/60 mb-2">{title}</div>
      <div className="text-xs divide-y divide-white/10">
        {items.length === 0 && <div className="py-2 text-white/60">暂无数据</div>}
        {items.map((it) => (
          <div key={it.label} className="py-1.5 flex items-center justify-between">
            <span className="truncate pr-2">{it.label}</span>
            <span className="text-white/80">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


