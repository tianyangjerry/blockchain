"use client";

import React, { useState } from "react";

interface ContractFormProps {
  onSubmit: (payload: { name: string; source: string }) => Promise<void> | void;
  submitting?: boolean;
}

export default function ContractForm({ onSubmit, submitting }: ContractFormProps) {
  const [name, setName] = useState("");
  const [source, setSource] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({ name, source });
    setName("");
    setSource("");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm mb-1">合约名称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none"
          placeholder="MyContract"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1">合约源码（可粘贴）</label>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 outline-none font-mono text-sm"
          placeholder="// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\ncontract MyContract { }"
          required
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-foreground text-background px-4 py-2 disabled:opacity-60"
      >
        {submitting ? "发布中..." : "发布合约"}
      </button>
    </form>
  );
}


