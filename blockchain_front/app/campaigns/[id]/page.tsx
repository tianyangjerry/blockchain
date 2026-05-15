"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, Campaign, Donation } from "../../lib/api";
import DonateForm from "../../components/DonateForm";
import CampaignUpdateForm from "../../components/CampaignUpdateForm";

function CampaignDetailInner() {
  const params = useParams();
  const id = String(params?.id || "");

  const { data, isLoading, refetch } = useQuery<Campaign & { donations?: Donation[]; updates?: { id: string; author: string; content: string; createdAt: string }[] }>({
    queryKey: ["campaign", id],
    queryFn: async () => {
      try {
        return await api.getCampaign(id);
      } catch {
        // 后端未就绪时的占位数据
        return {
          id,
          title: "示例项目",
          description:
            "这是一条示例项目详情。当后端就绪后，这里将展示实时数据与捐赠记录。",
          goalAmount: "100",
          raisedAmount: "32.5",
          status: "active",
          image: "/globe.svg",
          donations: [
            {
              id: "d1",
              campaignId: id,
              donor: "0xabc...1234",
              amount: "1.5",
              timestamp: new Date().toISOString(),
              token: "ETH",
            },
          ],
        } as any;
      }
    },
    enabled: !!id,
    retry: 0,
  });

  const goal = parseFloat(data?.goalAmount || "0");
  const raised = parseFloat(data?.raisedAmount || "0");
  const ratio = goal > 0 ? Math.min(raised / goal, 1) : 0;
  const percent = Math.round(ratio * 100);
  const now = new Date();
  const startAt = data?.startAt ? new Date(data.startAt) : undefined as any;
  const endAt = data?.endAt ? new Date(data.endAt) : undefined as any;
  const notStarted = startAt && now < startAt;
  const ended = endAt && now > endAt;
  const completed = (data?.status === "completed") || (goal > 0 && raised >= goal);

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
        <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {data?.image && (
                <div className="mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={data.image} alt={data.title} className="h-full w-full object-cover" />
                </div>
              )}
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">{data?.title}</span>
              </h1>
              <p className="mt-2 text-sm text-white/80">{data?.description}</p>

              <div className="mt-6">
                <h2 className="text-sm font-medium text-white/70">最近捐赠</h2>
                <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] divide-y divide-white/10">
                  {(data?.donations || []).length === 0 && (
                    <div className="p-4 text-sm text-white/60">暂无捐赠记录</div>
                  )}
                  {(data?.donations || []).map((d) => (
                    <div key={d.id} className="p-4 text-xs sm:text-sm flex items-center justify-between">
                      <span className="text-white/80">{d.donor}</span>
                      <span className="text-white">{d.amount} {d.token || "ETH"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-[#F5C542]" style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                  <span data-raised={raised}>已筹 {raised}</span>
                  <span data-goal={goal}>目标 {goal}</span>
                </div>

                <div className="mt-4">
                  <h3 className="text-sm font-medium text-white/80">捐赠</h3>
                  <div className="mt-2">
                    {notStarted && <div className="text-xs text-white/60">项目未开始</div>}
                    {ended && <div className="text-xs text-white/60">项目已结束</div>}
                    {completed && <div className="text-xs text-emerald-400">项目已完成，感谢支持！</div>}
                    {!notStarted && !ended && !completed && (
                      <DonateForm
                        campaignId={id}
                        status={data?.status}
                        goalAmount={data?.goalAmount}
                        raisedAmount={data?.raisedAmount}
                        onSuccess={()=>refetch()}
                      />
                    )}
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-medium text-white/80">项目更新</h3>
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/10">
                    {(data as any)?.updates?.length ? (data as any).updates.map((u: any) => (
                      <div key={u.id} className="p-3 text-xs">
                        <div className="text-white/60">{u.createdAt}</div>
                        <div className="mt-1 text-white/90 whitespace-pre-wrap">{u.content}</div>
                      </div>
                    )) : <div className="p-3 text-white/60 text-xs">暂无更新</div>}
                  </div>
                  <div className="mt-3">
                    <CampaignUpdateForm campaignId={id} onPosted={()=>refetch()} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default dynamic(() => Promise.resolve(CampaignDetailInner), { ssr: false });


