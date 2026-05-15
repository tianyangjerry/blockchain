"use client";

import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import ContractDeployForm from "../components/ContractDeployForm";
import TxStatus from "../components/TxStatus";
import RewardConfigForm from "../components/RewardConfigForm";
import CampaignCreateForm from "../components/CampaignCreateForm";
import CampaignWithdrawForm from "../components/CampaignWithdrawForm";
import SmtpTools from "../components/SmtpTools";
import OrgApproval from "../components/OrgApproval";
import AdminAnalytics from "../components/AdminAnalytics";
import PerfTools from "../components/PerfTools";
import { api, Campaign } from "../lib/api";
import { getAuthToken, withAuth } from "../lib/auth";
import { ensureAccounts } from "../lib/web3";

function AdminPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const qc = useQueryClient();
  const [selectedCid, setSelectedCid] = useState("");
  const { data: campaigns = [], isLoading: isCampaignsLoading, refetch: refetchCampaigns } = useQuery<Campaign[]>({
    queryKey: ["admin-campaigns"],
    queryFn: api.listCampaigns,
    staleTime: 30000,
    placeholderData: [],
    select: (d) => Array.isArray(d) ? d : [],
  });
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // 清理函数，防止组件卸载后更新状态
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const shortAddr = useMemo(() => user?.address ? `${user.address.slice(0,6)}...${user.address.slice(-4)}` : "", [user]);

  const handleDeploy = async ({ name, abi, bytecode, args }: { name: string; abi: string; bytecode: string; args: unknown[] }) => {
    if (!isMountedRef.current) return;
    
    setSubmitting(true);
    setTxStatus("pending");
    setError(undefined);
    setTxHash(undefined);
    
    try {
      // 管理员签名换取 token
      const token = await getAuthToken("admin");
      // 确保钱包连接（前端签名模式时会用到）
      try { await ensureAccounts(); } catch {}
      const res = await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + "/api/contracts/deploy", withAuth({
        method: "POST",
        body: JSON.stringify({ name, abi, bytecode, constructorArgs: args }),
      }, token));
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if ((data as any)?.error) msg = (data as any).error;
        } catch {}
        throw new Error(msg);
      }
      const rec = await res.json();
      
      // 检查组件是否仍然挂载
      if (!isMountedRef.current) return;
      
      setTxHash(rec.txHash);
      setTxStatus("success");
      
      // 使 contracts 列表失效，触发仪表盘重新拉取
      try { await qc.invalidateQueries({ queryKey: ["contracts"] }); } catch {}
    } catch (e: any) {
      // 检查组件是否仍然挂载
      if (!isMountedRef.current) return;
      
      setError(e?.message || "发布失败");
      setTxStatus("error");
    } finally {
      // 检查组件是否仍然挂载
      if (!isMountedRef.current) return;
      
      setSubmitting(false);
    }
  };

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

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)] text-white">
          <div className="text-center animate-fade-in">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto"></div>
            <p className="mt-2 text-sm text-white/70">加载中...</p>
          </div>
        </div>
      ) : (
        (isAuthenticated && user?.role !== "admin") ? (
          <div className="relative max-w-7xl mx-auto px-4 py-12 text-white animate-fade-in">
            <div className="mb-4 flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">角色：用户</span>
              {user?.address && <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">地址：{shortAddr}</span>}
            </div>
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">
              您没有访问管理员页面的权限。如需开通，请联系管理员将您的地址加入白名单。
            </div>
          </div>
        ) : (
          <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
            <div className="mb-6 flex items-start justify-between gap-4 animate-slide-up">
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                  <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">管理员仪表板</span>
                </h1>
                <p className="text-sm text-white/70 mt-1">发布新合约到网络</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">角色：管理员</span>
                {user?.address && <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">地址：{shortAddr}</span>}
                <button
                  onClick={() => router.push("/admin/analytics")}
                  className="ml-2 px-3 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60"
                >
                  查看 Gas 指标
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-3">发布合约</h2>
              <ContractDeployForm onDeploy={handleDeploy} submitting={submitting} />
            </div>

            <div className="mt-4">
              <TxStatus status={txStatus} txHash={txHash} message={error} />
            </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-3">奖励配置</h2>
              <p className="text-sm text-white/70 mb-3">配置捐赠积分、NFT 阈值、每日上限与冷却时间。</p>
              <RewardConfigForm />
            </div>

          <div className="mt-4">
            <SmtpTools />
          </div>

          <div className="mt-6">
            <OrgApproval />
          </div>

          <div className="mt-6">
            <AdminAnalytics />
          </div>

          <div className="mt-6">
            <PerfTools />
          </div>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-3">创建募捐项目</h2>
                <CampaignCreateForm onCreated={async () => { try { await qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); await refetchCampaigns(); } catch {} }} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <h2 className="text-lg font-semibold mb-3">项目提现</h2>
                <p className="text-sm text-white/70 mb-2">选择项目并输入金额</p>
                <div className="grid grid-cols-1 gap-2">
                  <select
                    value={selectedCid}
                    onChange={(e) => setSelectedCid(e.target.value)}
                    className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60"
                  >
                    <option value="" disabled>{isCampaignsLoading ? "加载项目中..." : "请选择项目"}</option>
                    {campaigns.map((c) => {
                      const raised = parseFloat(c.raisedAmount || "0");
                      const withdrawn = parseFloat((c as any).withdrawnAmount || "0");
                      const available = Math.max(raised - withdrawn, 0);
                      return (
                        <option key={c.id} value={c.id} disabled={available <= 0}>
                          {c.title}（{c.id}） · 可提 {available.toFixed(4)} ETH
                        </option>
                      );
                    })}
                  </select>
                  {selectedCid ? (
                    <CampaignWithdrawForm id={selectedCid} onDone={async () => { try { await qc.invalidateQueries({ queryKey: ["admin-campaigns"] }); await refetchCampaigns(); } catch {} }} />
                  ) : (
                    <div className="text-xs text-white/60">请选择一个项目以继续提现</div>
                  )}
                </div>
            </div>
          </div>

            <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.04] p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">项目管理面板</h2>
                <button onClick={() => refetchCampaigns()} className="px-3 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-sm transition hover:border-[#F5C542]/60">刷新</button>
              </div>
              {isCampaignsLoading ? (
                <div className="mt-3 text-sm text-white/70">加载中...</div>
              ) : (
                <div className="mt-3 divide-y divide-white/10">
                  {campaigns.length === 0 && <div className="py-3 text-sm text-white/70">暂无项目</div>}
                  {campaigns.map(c => {
                    const raised = parseFloat(c.raisedAmount || "0");
                    const withdrawn = parseFloat((c as any).withdrawnAmount || "0");
                    const available = Math.max(raised - withdrawn, 0);
                    const now = new Date();
                    const startAt = (c as any).startAt ? new Date((c as any).startAt) : undefined as any;
                    const endAt = (c as any).endAt ? new Date((c as any).endAt) : undefined as any;
                    const notStarted = startAt && now < startAt;
                    const ended = endAt && now > endAt;
                    const cap = parseFloat((c as any).capAmount || "0");
                    const reachedCap = cap > 0 && raised >= cap;
                    return (
                      <div key={c.id} className="py-3 flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <div className="font-medium text-white truncate">{c.title} <span className="text-white/50">（{c.id}）</span></div>
                          <div className="text-white/60 mt-0.5 flex items-center gap-2">
                            <span>受益人：{(c as any).beneficiary || "-"}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md border border-white/10">
                              {ended ? "已结束" : notStarted ? "未开始" : (reachedCap || c.status === "completed") ? "已达上限" : "进行中"}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-white/90">已筹 {raised.toFixed(4)} ETH</span>
                          <span className="text-white/70">已提 {withdrawn.toFixed(4)} ETH</span>
                          <span className="text-[#F5C542]">可提 {available.toFixed(4)} ETH</span>
                          <button
                            disabled={available <= 0 || withdrawingId === c.id}
                            onClick={async () => {
                              try {
                                setWithdrawingId(c.id);
                                const token = await getAuthToken("admin");
                                await fetch((process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080") + `/api/campaigns/${c.id}/withdraw`, withAuth({
                                  method: "POST",
                                  body: JSON.stringify({ amount: available.toString() })
                                }, token));
                                await qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
                                await refetchCampaigns();
                              } catch {
                              } finally {
                                setWithdrawingId(null);
                              }
                            }}
                            className="px-3 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90 text-xs transition hover:border-[#F5C542]/60 disabled:opacity-60"
                          >{withdrawingId === c.id ? "处理中..." : "提全部"}</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </section>
  );
}

export default dynamic(() => Promise.resolve(AdminPage), { ssr: false });
