 "use client";

import { useEffect, useMemo, useState } from "react";
import Guard from "../../components/Guard";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<number>(30);
  const [loading, setLoading] = useState(false);
  const [gasSeries, setGasSeries] = useState<any[]>([]);
  const [methods, setMethods] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [topTxs, setTopTxs] = useState<any[]>([]);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      setLoading(true);
      try {
        const [g, m, c, t] = await Promise.all([
          fetch(`${API_BASE}/api/analytics/gas?days=${days}`).then((r) => r.json()),
          fetch(`${API_BASE}/api/analytics/methods?days=${days}&limit=20`).then((r) => r.json()),
          fetch(`${API_BASE}/api/analytics/campaigns?days=${days}&limit=20`).then((r) => r.json()),
          fetch(`${API_BASE}/api/analytics/top?limit=20`).then((r) => r.json()),
        ]);
        if (aborted) return;
        setGasSeries(Array.isArray(g) ? g.map((d: any) => ({ ...d, total_gas: Number(d.total_gas), day: d.day })) : []);
        setMethods(Array.isArray(m) ? m.map((x: any) => ({ ...x, avg_gas: Number(x.avg_gas), p50: Number(x.p50), p95: Number(x.p95) })) : []);
        setCampaigns(Array.isArray(c) ? c.map((x: any) => ({ ...x, total_gas: Number(x.total_gas), avg_gas: Number(x.avg_gas) })) : []);
        setTopTxs(Array.isArray(t) ? t : []);
      } catch (e) {
        // 如果后端不可用或返回错误，后面会用 Mock 数据回退
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    load();
    return () => {
      aborted = true;
    };
  }, [days]);

  const chartData = useMemo(() => {
    return gasSeries.map((d) => ({ date: d.day, total: d.total_gas, count: d.tx_count }));
  }, [gasSeries]);

  // ===== mock data fallback =====
  // 当后端无数据时，使用假数据展示（便于本地开发与演示）
  const mockChartData = useMemo(() => {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date();
      dt.setDate(dt.getDate() - i);
      const day = dt.toISOString().slice(0, 10);
      const total = Math.round(50000 + Math.random() * 50000); // 模拟 Gas 总量
      const count = Math.round(50 + Math.random() * 150);
      out.push({ date: day, total, count });
    }
    return out;
  }, [days]);

  const mockMethods = useMemo(() => {
    const names = ["donate()", "withdraw()", "createCampaign()", "mintBadge()", "register()"];
    return names.map((n, i) => ({ method: n, avg_gas: Math.round(20000 + i * 5000 + Math.random() * 10000), tx_count: Math.round(20 + Math.random() * 200) }));
  }, []);

  const mockCampaigns = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({ campaign_id: `campaign-${i + 1}`, total_gas: Math.round(10000 + Math.random() * 40000), avg_gas: Math.round(8000 + Math.random() * 6000), tx_count: Math.round(10 + Math.random() * 120) }));
  }, []);

  const mockTopTxs = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({ tx_hash: `0x${(Math.random() + 1).toString(36).slice(2, 12)}`, method: ["donate()", "withdraw()", "mintBadge()"][i % 3], gas_used: Math.round(50000 + Math.random() * 150000), tx_fee_eth: (0.001 + Math.random() * 0.05).toFixed(6) }));
  }, []);

  // 选择最终用于展示的数据：优先后端数据，否则使用 mock
  const finalChartData = chartData.length ? chartData : mockChartData;
  const finalMethods = methods.length ? methods : mockMethods;
  const finalCampaigns = campaigns.length ? campaigns : mockCampaigns;
  const finalTopTxs = topTxs.length ? topTxs : mockTopTxs;

  const pieColors = ["#F5C542", "#8cc0ff", "#a6e3a1", "#ff9fb1", "#d6b3ff", "#ffd8a8"];

  return (
    <Guard requireAuth={true} requireRole={"admin"}>
      <div className="min-h-[60vh] p-6">
        <div className="max-w-6xl mx-auto">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-white">Analytics — Gas 指标</h1>
          <div className="flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 rounded-md text-sm ${days === d ? "bg-[#F5C542] text-black" : "bg-white/[0.04] text-white"}`}
              >
                最近 {d} 天
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm text-white/80 mb-2">总 Gas（按日）</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={finalChartData}>
                  <CartesianGrid stroke="#222" />
                  <XAxis dataKey="date" tick={{ fill: "#ddd" }} />
                  <YAxis tick={{ fill: "#ddd" }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#F5C542" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm text-white/80 mb-2">按方法平均 Gas（Top 20）</h2>
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={finalMethods}>
                  <CartesianGrid stroke="#222" />
                  <XAxis dataKey="method" tick={{ fill: "#ddd" }} />
                  <YAxis tick={{ fill: "#ddd" }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avg_gas" fill="#F5C542" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs text-white/70">
              p50 与 p95 可用于衡量分布，当前面板展示 avg（条形）与可在方法明细中查看 p50/p95。
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm text-white/80 mb-2">按 Campaign 聚合（Top 20）</h3>
            <div className="max-h-64 overflow-auto text-xs text-white/70">
              <table className="w-full">
                <thead>
                  <tr><th className="text-left">Campaign</th><th className="text-right">总 Gas</th><th className="text-right">avg Gas</th><th className="text-right">笔数</th></tr>
                </thead>
                <tbody>
                  {finalCampaigns.map((c) => (
                    <tr key={c.campaign_id}><td className="truncate max-w-[18rem]">{c.campaign_id}</td><td className="text-right">{c.total_gas}</td><td className="text-right">{c.avg_gas}</td><td className="text-right">{c.tx_count}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm text-white/80 mb-2">Top 高耗交易</h3>
            <div className="max-h-64 overflow-auto text-xs text-white/70">
              <table className="w-full">
                <thead>
                  <tr><th>Tx</th><th className="text-right">方法</th><th className="text-right">Gas</th><th className="text-right">手续费(ETH)</th></tr>
                </thead>
                <tbody>
                  {finalTopTxs.map((t) => (
                    <tr key={t.tx_hash}><td className="truncate max-w-[12rem]"><a className="text-[#F5C542]" href="#" onClick={(e)=>e.preventDefault()}>{t.tx_hash}</a></td><td className="text-right">{t.method}</td><td className="text-right">{t.gas_used}</td><td className="text-right">{t.tx_fee_eth}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 额外：方法分布饼图（可视化各方法占比） */}
        <div className="mt-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h3 className="text-sm text-white/80 mb-2">方法调用占比（示例）</h3>
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={finalMethods} dataKey="tx_count" nameKey="method" innerRadius={40} outerRadius={80} paddingAngle={4}>
                    {finalMethods.map((_, idx) => <Cell key={idx} fill={pieColors[idx % pieColors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Guard>
  );
}


