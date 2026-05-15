"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api, ContractRecord } from "../../lib/api";
import { getWeb3, ensureAccounts } from "../../lib/web3";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ContractDetailPage() {
  const params = useParams();
  const address = params?.address as string;
  const [error, setError] = useState<string | null>(null);
  const [methodName, setMethodName] = useState<string>("");
  const [args, setArgs] = useState<string>("[]");
  const [callResult, setCallResult] = useState<string>("");
  const [writeMethod, setWriteMethod] = useState<string>("");
  const [writeArgs, setWriteArgs] = useState<string>("[]");
  const [txHash, setTxHash] = useState<string>("");
  const [writing, setWriting] = useState(false);
  const qc = useQueryClient();

  const { data: rec, isLoading } = useQuery<ContractRecord | null>({
    queryKey: ["contract", address],
    queryFn: async () => {
      try {
        return await api.getContract(address);
      } catch (e: any) {
        setError(e?.message || "加载失败");
        return null;
      }
    },
    staleTime: 30000,
    retry: 1,
  });

  const abi = useMemo(() => {
    try {
      return rec?.abi ? JSON.parse(rec.abi) : [];
    } catch {
      return [];
    }
  }, [rec]);

  const viewMethods = useMemo(() => {
    return Array.isArray(abi) ? abi.filter((e: any) => e.type === "function" && (e.stateMutability === "view" || e.stateMutability === "pure")).map((e: any) => e.name) : [];
  }, [abi]);

  const writeMethods = useMemo(() => {
    return Array.isArray(abi) ? abi.filter((e: any) => e.type === "function" && !(e.stateMutability === "view" || e.stateMutability === "pure")).map((e: any) => e.name) : [];
  }, [abi]);

  // 选中方法的 ABI 输入定义
  const selectedViewInputs = useMemo(() => {
    const f = Array.isArray(abi) ? (abi as any[]).find(e => e.type === "function" && e.name === methodName) : null;
    return f?.inputs ?? [];
  }, [abi, methodName]);
  const selectedWriteInputs = useMemo(() => {
    const f = Array.isArray(abi) ? (abi as any[]).find(e => e.type === "function" && e.name === writeMethod) : null;
    return f?.inputs ?? [];
  }, [abi, writeMethod]);

  // 示例生成
  function exampleForType(t: string): any {
    const base = t.replace(/\s+/g, "");
    if (base.startsWith("bytes32")) return "0x" + "00".repeat(32);
    if (base === "bytes") return "0x";
    if (base === "address") return "0x0000000000000000000000000000000000000000";
    if (base.startsWith("uint") || base.startsWith("int")) return "0";
    if (base === "string") return "sample";
    if (base.endsWith("[]")) return [];
    return null;
  }
  const viewExample = useMemo(() => {
    try { return JSON.stringify(selectedViewInputs.map((i: any) => exampleForType(i.type))); } catch { return "[]"; }
  }, [selectedViewInputs]);
  const writeExample = useMemo(() => {
    try { return JSON.stringify(selectedWriteInputs.map((i: any) => exampleForType(i.type))); } catch { return "[]"; }
  }, [selectedWriteInputs]);

  // 简易校验：必须是 JSON 数组，长度与 inputs 一致
  function validateArgsString(str: string, inputs: any[]): { ok: boolean; msg?: string } {
    let parsed: any;
    try {
      parsed = JSON.parse(str || "[]");
    } catch {
      return { ok: false, msg: "参数必须是合法 JSON" };
    }
    if (!Array.isArray(parsed)) return { ok: false, msg: "参数必须是 JSON 数组" };
    if (parsed.length !== inputs.length) return { ok: false, msg: `需要 ${inputs.length} 个参数，当前为 ${parsed.length}` };
    return { ok: true };
  }

  useEffect(() => {
    setMethodName("");
    setArgs("[]");
    setCallResult("");
    setWriteMethod("");
    setWriteArgs("[]");
    setTxHash("");
    setError(null);
  }, [address]);

  const callMutation = useMutation({
    mutationFn: async () => {
      const web3 = getWeb3();
      const contract = new (web3 as any).eth.Contract(abi, address);
      const parsedArgs = JSON.parse(args || "[]");
      const result = await (contract.methods as any)[methodName](...parsedArgs).call();
      return result;
    },
    onSuccess: (res) => {
      setCallResult(JSON.stringify(res));
    },
    onError: (e: any) => {
      setError(e?.message || "调用失败");
    },
  });

  const writeMutation = useMutation({
    mutationFn: async () => {
      await ensureAccounts();
      const web3 = getWeb3();
      const [from] = await (web3.eth.getAccounts());
      const contract = new (web3 as any).eth.Contract(abi, address);
      const parsedArgs = JSON.parse(writeArgs || "[]");
      const tx = (contract.methods as any)[writeMethod](...parsedArgs);
      const gas = await tx.estimateGas({ from });
      const sent = await tx.send({ from, gas });
      return sent?.transactionHash as string;
    },
    onMutate: () => {
      setError(null);
      setTxHash("");
      setWriting(true);
    },
    onSuccess: async (hash) => {
      setTxHash(hash || "");
      try { await qc.invalidateQueries({ queryKey: ["contract", address] }); } catch {}
    },
    onError: (e: any) => {
      setError(e?.message || "交易失败");
    },
    onSettled: () => setWriting(false),
  });

  // 背景容器（统一黑金风）
  const Background = ({ children }: { children: React.ReactNode }) => (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-20 bg-[#0a0a0a]" />
      <div className="absolute inset-0 -z-10 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "48px 48px", backgroundPosition: "center top" }} />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 -z-10 w-[70rem] h-[70rem] rounded-full blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(245,197,66,0.18), transparent 65%)" }} />
      {children}
    </section>
  );

  if (isLoading) {
    return (
      <Background>
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)] text-white">
          <div className="text-center animate-fade-in">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white/60 mx-auto"></div>
            <p className="mt-2 text-sm text-white/70">加载中...</p>
          </div>
        </div>
      </Background>
    );
  }

  if (error) {
    return (
      <Background>
        <div className="max-w-3xl mx-auto px-4 py-12 text-white">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">{error}</div>
        </div>
      </Background>
    );
  }

  if (!rec) return null;

  // 参数提示文本
  const viewParamHint = selectedViewInputs.length > 0 ? `参数：${selectedViewInputs.map((i: any) => `${i.type} ${i.name || ""}`.trim()).join(", ")}` : "参数：无";
  const writeParamHint = selectedWriteInputs.length > 0 ? `参数：${selectedWriteInputs.map((i: any) => `${i.type} ${i.name || ""}`.trim()).join(", ")}` : "参数：无";

  // 校验状态
  const viewValid = validateArgsString(args, selectedViewInputs);
  const writeValid = validateArgsString(writeArgs, selectedWriteInputs);

  return (
    <Background>
      <div className="relative max-w-7xl mx-auto px-4 py-10 text-white animate-fade-in">
        <div className="mb-6 animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">合约详情</span>
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70 break-all">
            <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">{rec.name}</span>
            <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">{rec.address}</span>
            {rec.network && <span className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04]">{rec.network}</span>}
            <button className="ml-1 px-2 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/90" onClick={() => navigator.clipboard?.writeText(rec.address)}>复制地址</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="font-medium text-white">只读方法调用</h2>
            <div className="relative inline-flex w-full">
              <select value={methodName} onChange={(e) => setMethodName(e.target.value)} className="appearance-none w-full rounded-md border border-white/25 bg-white/[0.08] px-3 py-2 pr-8 text-white outline-none focus:ring-2 focus:ring-[#F5C542]/40">
                <option value="">选择方法</option>
                {viewMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/80">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
              </span>
            </div>
            <div className="text-xs text-white/70">{viewParamHint}</div>
            {selectedViewInputs.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span>示例：</span>
                <code className="px-2 py-1 rounded border border-white/10 bg-white/[0.04]">{viewExample}</code>
                <button type="button" className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/80 hover:border-[#F5C542]/60" onClick={() => setArgs(viewExample)}>一键填充</button>
              </div>
            )}
            <textarea value={args} onChange={(e) => setArgs(e.target.value)} rows={4} className={`w-full rounded-md border px-3 py-2 text-white placeholder-white/40 outline-none font-mono text-xs ${viewValid.ok ? "border-white/15 bg-white/[0.02] focus:ring-2 focus:ring-[#F5C542]/40" : "border-red-500/40 bg-red-500/10"}`} placeholder={'参数 JSON 数组，如 ["0xabc...", 123]'} />
            {!viewValid.ok && <div className="text-xs text-red-300">{viewValid.msg}</div>}
            <button onClick={() => {
              const v = validateArgsString(args, selectedViewInputs);
              if (!v.ok) { setError(v.msg || "参数不合法"); return; }
              setError(null);
              callMutation.mutate();
            }} className="rounded-md bg-[#F5C542] text-black px-4 py-2 text-sm transition hover:brightness-95" disabled={!methodName || callMutation.isPending || !viewValid.ok}> {callMutation.isPending ? "调用中..." : "调用"}</button>
            {callResult && <pre className="mt-2 text-xs whitespace-pre-wrap break-all text-white/90">{callResult}</pre>}
          </div>

          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="font-medium text-white">写方法调用</h2>
            <div className="relative inline-flex w-full">
              <select value={writeMethod} onChange={(e) => setWriteMethod(e.target.value)} className="appearance-none w-full rounded-md border border-white/25 bg-white/[0.08] px-3 py-2 pr-8 text-white outline-none focus:ring-2 focus:ring-[#F5C542]/40">
                <option value="">选择方法</option>
                {writeMethods.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/80">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
              </span>
            </div>
            <div className="text-xs text-white/70">{writeParamHint}</div>
            {selectedWriteInputs.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span>示例：</span>
                <code className="px-2 py-1 rounded border border-white/10 bg-white/[0.04]">{writeExample}</code>
                <button type="button" className="px-2 py-1 rounded-md border border-white/15 bg-white/[0.04] text-white/80 hover:border-[#F5C542]/60" onClick={() => setWriteArgs(writeExample)}>一键填充</button>
              </div>
            )}
            <textarea value={writeArgs} onChange={(e) => setWriteArgs(e.target.value)} rows={3} className={`w-full rounded-md border px-3 py-2 text-white placeholder-white/40 outline-none font-mono text-xs ${writeValid.ok ? "border-white/15 bg-white/[0.02] focus:ring-2 focus:ring-[#F5C542]/40" : "border-red-500/40 bg-red-500/10"}`} placeholder="参数 JSON 数组" />
            {!writeValid.ok && <div className="text-xs text-red-300">{writeValid.msg}</div>}
            <button onClick={() => {
              const v = validateArgsString(writeArgs, selectedWriteInputs);
              if (!v.ok) { setError(v.msg || "参数不合法"); return; }
              setError(null);
              writeMutation.mutate();
            }} className="rounded-md bg-[#F5C542] text-black px-4 py-2 text-sm transition hover:brightness-95" disabled={!writeMethod || writing || !writeValid.ok}>{writing ? "提交中..." : "提交交易"}</button>
            {txHash && <div className="text-sm break-all text-white/80">Tx: {txHash}</div>}
          </div>

          <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <h2 className="font-medium mb-2 text-white">ABI</h2>
            <pre className="text-xs whitespace-pre-wrap break-all p-3 rounded-md border border-white/10 max-h-72 overflow-auto">{rec.abi}</pre>
          </div>
        </div>
      </div>
    </Background>
  );
}


