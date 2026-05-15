"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface Props {
  onDeploy: (payload: { name: string; abi: string; bytecode: string; args: unknown[] }) => Promise<void> | void;
  submitting?: boolean;
}

export default function ContractDeployForm({ onDeploy, submitting }: Props) {
  const [name, setName] = useState("");
  const [abi, setAbi] = useState("");
  const [bytecode, setBytecode] = useState("");
  const [constructorArgs, setConstructorArgs] = useState<string>("[]");
  const [template, setTemplate] = useState<string>("");
  const [templateList, setTemplateList] = useState<string[]>([]);

  // 模板列表
  const { data: templatesData } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => api.listTemplates(),
    staleTime: 30000,
    retry: 1,
  });
  useEffect(() => {
    if (templatesData) setTemplateList(templatesData.map(t => t.name));
  }, [templatesData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let args: unknown[] = [];
    try {
      args = JSON.parse(constructorArgs || "[]");
      if (!Array.isArray(args)) throw new Error("constructorArgs 必须是数组");
    } catch (e: any) {
      alert(e?.message || "constructorArgs JSON 解析失败");
      return;
    }
    await onDeploy({ name, abi, bytecode, args });
  };

  const applyTemplate = (key: string) => {
    setTemplate(key);
  };

  // 当前选中模板详情
  const { data: templateData } = useQuery({
    queryKey: ["template", template],
    queryFn: async () => template ? api.getTemplate(template) : Promise.resolve(null),
    enabled: !!template,
    staleTime: 30000,
    retry: 0,
  });
  useEffect(() => {
    if (template && templateData) {
      setName(templateData.name || template);
      setAbi(JSON.stringify(templateData.abi || []));
      setBytecode(templateData.bytecode || "");
      setConstructorArgs(templateData.constructorArgsExample ? JSON.stringify(templateData.constructorArgsExample) : "[]");
    }
  }, [template, templateData]);

  const onUploadArtifact: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const artifactAbi = json.abi ? JSON.stringify(json.abi) : "";
      const artifactBytecode = json.bytecode || json.data?.bytecode?.object || "";
      if (!artifactAbi || !artifactBytecode) throw new Error("未检测到 abi 或 bytecode 字段");

      setAbi(artifactAbi);
      setBytecode(artifactBytecode);
      setName(json.contractName || name || file.name.replace(/\.json$/i, ""));
    } catch (err: any) {
      alert(err?.message || "解析 artifact 失败");
    } finally {
      e.currentTarget.value = "";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-white/70">模板</label>
        <div className="relative inline-flex items-center">
          <select
            value={template}
            onChange={(e) => applyTemplate(e.target.value)}
            className="appearance-none w-56 sm:w-64 rounded-md border border-white/25 bg-white/[0.08] px-3 py-2 pr-8 text-white outline-none focus:ring-2 focus:ring-[#F5C542]/40"
          >
            <option value="">请选择模板（可选）</option>
            {templateList.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 text-white/80">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.08 1.04l-4.25 4.25a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
          </span>
        </div>
        <label className="text-sm text-white/70">或上传 artifact.json</label>
        <input type="file" accept="application/json" onChange={onUploadArtifact} className="text-sm text-white/80" />
      </div>
      <div>
        <label className="block text-sm mb-1">合约名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none" required />
      </div>
      <div>
        <label className="block text-sm mb-1">ABI (JSON)</label>
        <textarea value={abi} onChange={(e) => setAbi(e.target.value)} rows={8} className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none font-mono text-xs" required />
      </div>
      <div>
        <label className="block text-sm mb-1">Bytecode (0x...)</label>
        <textarea value={bytecode} onChange={(e) => setBytecode(e.target.value)} rows={4} className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none font-mono text-xs" required />
      </div>
      <div>
        <label className="block text-sm mb-1">构造参数 (JSON 数组)</label>
        <textarea value={constructorArgs} onChange={(e) => setConstructorArgs(e.target.value)} rows={3} className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none font-mono text-xs" />
      </div>
      <button type="submit" disabled={submitting} className="rounded-md bg-foreground text-background px-4 py-2 disabled:opacity-60">{submitting ? "发布中..." : "发布合约"}</button>
    </form>
  );
}


