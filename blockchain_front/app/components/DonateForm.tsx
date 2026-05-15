"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TxStatus from "./TxStatus";
import { ensureAccounts, getWeb3 } from "../lib/web3";
import { DONATION_CAMPAIGNS_ABI, ERC20_MIN_ABI } from "../lib/abi";

interface DonateFormProps {
  campaignId: string;
  receiver?: string; // 直付收款地址（若未配置合约时兜底）
  donateContract?: string; // DonationCampaigns 合约地址（0x...）
  erc20Token?: string; // 如填写则按 ERC20 流程
  onSuccess?: (txHash: string) => void;
  status?: string; // 父组件传入的最新项目状态
  goalAmount?: string; // 父组件传入，用于判断是否达标
  raisedAmount?: string; // 父组件传入，用于判断是否达标
}

export default function DonateForm({ campaignId, receiver, donateContract, erc20Token, onSuccess, status, goalAmount, raisedAmount }: DonateFormProps) {
  const [amount, setAmount] = useState<string>("");
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [errMsg, setErrMsg] = useState<string | undefined>(undefined);
  const [runtimeContract, setRuntimeContract] = useState<string>("");
  const [campaignStatus, setCampaignStatus] = useState<string>("");

  useEffect(() => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
    fetch(`${API_BASE}/api/config`).then(r => r.ok ? r.json() : null).then((cfg) => {
      if (cfg && typeof cfg.donationContractAddress === "string") {
        setRuntimeContract(cfg.donationContractAddress);
      }
    }).catch(() => {});
    // 拉取项目状态，若已完成则禁用捐赠
    fetch(`${API_BASE}/api/campaigns/${campaignId}`).then(r=>r.ok?r.json():null).then((d)=>{
      if (d && typeof d.status === "string") setCampaignStatus(d.status);
    }).catch(()=>{});
  }, []);

  // 监听父组件传入的最新状态，实时禁用按钮
  useEffect(() => {
    if (typeof status === "string") setCampaignStatus(status);
  }, [status]);

  const finalReceiver = useMemo(() => receiver || process.env.NEXT_PUBLIC_DONATION_RECEIVER || "", [receiver]);
  const disabledReason = useMemo(() => {
    if (campaignStatus === "completed") return "项目已完成，无法继续捐赠";
    // 若父组件给出金额，达到目标也禁用
    const g = parseFloat(String(goalAmount || "0"));
    const r = parseFloat(String(raisedAmount || "0"));
    if (g > 0 && r >= g) return "已达目标，无法继续捐赠";
    const contractAddr = (process.env.NEXT_PUBLIC_DONATION_CONTRACT || "").trim() || "";
    const hasContract = Boolean(donateContract || contractAddr || runtimeContract);
    // 如果已配置合约地址，则无需收款地址，按钮不应禁用
    if (!hasContract && !finalReceiver) return "未配置收款地址（NEXT_PUBLIC_DONATION_RECEIVER）";
    return "";
  }, [finalReceiver, donateContract, runtimeContract, campaignStatus, goalAmount, raisedAmount]);

  const onDonate = useCallback(async () => {
    setErrMsg(undefined);
    setTxHash(undefined);
    // 若没有合约地址，才要求直付收款地址
    const envContract = (process.env.NEXT_PUBLIC_DONATION_CONTRACT || "").trim() || runtimeContract || "";
    const hasContract = Boolean(donateContract || envContract);
    if (!hasContract && !finalReceiver) {
      setTxStatus("error");
      setErrMsg("未配置收款地址");
      return;
    }
    const parsed = parseFloat(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setTxStatus("error");
      setErrMsg("请输入正确的金额");
      return;
    }
    try {
      setTxStatus("pending");
      const [from] = await ensureAccounts();
      const web3 = getWeb3();
      const valueWei = web3.utils.toWei(String(parsed), "ether");

      const contractAddr = envContract;
      const donateToContract = (donateContract || contractAddr) && (!erc20Token || erc20Token === "ETH");
      let lastTx: string | undefined;

      if (erc20Token && erc20Token !== "ETH") {
        const token = new (web3.eth as any).Contract(ERC20_MIN_ABI as any, erc20Token);
        const spender = donateContract || contractAddr;
        if (!spender) throw new Error("未配置合约地址");
        const allowance: string = await token.methods.allowance(from, spender).call();
        const need = valueWei;
        if (BigInt(allowance) < BigInt(need)) {
          const approveTx = await token.methods.approve(spender, need).send({ from });
          setTxHash(approveTx?.transactionHash);
        }
        const donation = new (web3.eth as any).Contract(DONATION_CAMPAIGNS_ABI as any, spender);
        const idBytes32 = web3.utils.keccak256(campaignId);
        const txr = await donation.methods.donateERC20(idBytes32, erc20Token, need).send({ from });
        lastTx = txr?.transactionHash;
        setTxHash(lastTx);
      } else if (donateToContract) {
        const spender = donateContract || contractAddr;
        const donation = new (web3.eth as any).Contract(DONATION_CAMPAIGNS_ABI as any, spender);
        const idBytes32 = web3.utils.keccak256(campaignId);
        const txr = await donation.methods.donateETH(idBytes32).send({ from, value: valueWei });
        lastTx = txr?.transactionHash;
        setTxHash(lastTx);
      } else {
        // 直付兜底
        const tx = await (window as any).ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from,
              to: finalReceiver,
              value: web3.utils.toHex(valueWei),
            },
          ],
        });
        lastTx = tx;
        setTxHash(lastTx);
      }
      setTxStatus("success");
      if (lastTx) onSuccess?.(lastTx);
      setAmount("");
    } catch (e: any) {
      setTxStatus("error");
      setErrMsg(e?.message || "交易失败");
    }
  }, [amount, finalReceiver, onSuccess, donateContract, erc20Token]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-2">
        <input
          type="number"
          placeholder="输入金额（ETH）"
          className="w-full rounded-md border border-white/15 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:border-[#F5C542]/60"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="0.0001"
          disabled={!!disabledReason}
        />
        <button
          onClick={onDonate}
          disabled={!!disabledReason || !amount || txStatus === "pending"}
          className="px-3 py-2 rounded-md bg-[#F5C542] text-black text-sm transition hover:brightness-95 disabled:opacity-60"
          title={disabledReason || ""}
        >
          {txStatus === "pending" ? "提交中..." : "捐赠 ETH"}
        </button>
        <TxStatus status={txStatus} txHash={txHash} message={errMsg} />
        {disabledReason && (
          <p className="text-[11px] text-white/60">{disabledReason}</p>
        )}
        <p className="text-[11px] text-white/60">项目 ID：{campaignId}</p>
      </div>
    </div>
  );
}


