"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, RewardConfig } from "../lib/api";
import { getAuthToken, withAuth } from "../lib/auth";

export default function RewardConfigForm() {
  const qc = useQueryClient();
  const { data } = useQuery<RewardConfig>({
    queryKey: ["reward-config"],
    queryFn: api.getRewardConfig,
    staleTime: 60000,
  });

  const [pointPerETH, setPointPerETH] = useState("100");
  const [nftThresholdsJson, setNftThresholdsJson] = useState('{"bronze":"0.1","silver":"1","gold":"5"}');
  const [dailyCapPerAddress, setDailyCapPerAddress] = useState("1000");
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (data) {
      setPointPerETH(data.pointPerETH || "100");
      setNftThresholdsJson(data.nftThresholdsJson || '{"bronze":"0.1","silver":"1","gold":"5"}');
      setDailyCapPerAddress(data.dailyCapPerAddress || "1000");
      setCooldownSeconds(data.cooldownSeconds || 60);
    }
  }, [data]);

  const validJson = useMemo(() => {
    try { JSON.parse(nftThresholdsJson); return true; } catch { return false; }
  }, [nftThresholdsJson]);

  const onSave = async () => {
    setSaving(true);
    setError(undefined);
    setOk(false);
    try {
      if (!validJson) throw new Error("阈值必须是合法 JSON");
      const token = await getAuthToken("admin");
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/rewards/config", withAuth({
        method: "POST",
        body: JSON.stringify({ pointPerETH, nftThresholdsJson, dailyCapPerAddress, cooldownSeconds })
      }, token));
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try { const d = await res.json(); if ((d as any)?.error) msg = (d as any).error; } catch {}
        throw new Error(msg);
      }
      await qc.invalidateQueries({ queryKey: ["reward-config"] });
      setOk(true);
    } catch (e: any) {
      setError(e?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-3">
      <label className="text-sm">每 1 ETH 获得积分数</label>
      <input value={pointPerETH} onChange={(e) => setPointPerETH(e.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />

      <label className="text-sm mt-2">NFT 阈值（JSON）</label>
      <textarea value={nftThresholdsJson} onChange={(e) => setNftThresholdsJson(e.target.value)} rows={4} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />
      {!validJson && <span className="text-xs text-red-400">JSON 格式不正确</span>}

      <label className="text-sm mt-2">每日每地址积分上限</label>
      <input value={dailyCapPerAddress} onChange={(e) => setDailyCapPerAddress(e.target.value)} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />

      <label className="text-sm mt-2">发放冷却时间（秒）</label>
      <input type="number" value={cooldownSeconds} onChange={(e) => setCooldownSeconds(parseInt(e.target.value || "0", 10))} className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60" />

      <div className="mt-3 flex items-center gap-2">
        <button onClick={onSave} disabled={saving || !validJson} className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60">{saving ? "保存中..." : "保存配置"}</button>
        {ok && <span className="text-xs text-green-400">已保存</span>}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    </div>
  );
}


