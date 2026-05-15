"use client";

import React from "react";

export interface ContractItem {
  address: string;
  name: string;
  network?: string;
}

interface ContractListProps {
  items: ContractItem[];
  onSelect?: (address: string) => void;
}

export default function ContractList({ items, onSelect }: ContractListProps) {
  if (!items?.length) {
    return <div className="text-sm text-black/60 dark:text-white/60">暂无合约</div>;
  }
  return (
    <ul className="divide-y divide-black/10 dark:divide-white/15 rounded-md border border-black/10 dark:border-white/15 overflow-hidden">
      {items.map((c) => (
        <li key={c.address} className="p-3 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5">
          <div className="min-w-0">
            <p className="font-medium truncate">{c.name}</p>
            <p className="text-xs text-black/60 dark:text-white/60 truncate">{c.address}</p>
          </div>
          {onSelect && (
            <button onClick={() => onSelect?.(c.address)} className="px-3 py-1 text-sm rounded-md bg-foreground text-background">操作</button>
          )}
        </li>
      ))}
    </ul>
  );
}


