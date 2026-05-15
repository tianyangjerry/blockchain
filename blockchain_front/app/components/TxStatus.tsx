"use client";

interface TxStatusProps {
  status: "idle" | "pending" | "success" | "error";
  txHash?: string;
  message?: string;
}

export default function TxStatus({ status, txHash, message }: TxStatusProps) {
  if (status === "idle") return null;
  const color = status === "pending" ? "text-amber-500" : status === "success" ? "text-green-500" : "text-red-500";
  return (
    <div className={`text-sm ${color}`}>
      {status === "pending" && "交易提交中..."}
      {status === "success" && "交易已确认"}
      {status === "error" && (message || "交易失败")}
      {txHash && (
        <div className="mt-1 break-all opacity-80">
          Tx: {txHash}
          {process.env.NEXT_PUBLIC_ETHERSCAN_BASE && (
            <a className="ml-2 underline" target="_blank" href={`${process.env.NEXT_PUBLIC_ETHERSCAN_BASE}/tx/${txHash}`}>Etherscan</a>
          )}
        </div>
      )}
    </div>
  );
}


