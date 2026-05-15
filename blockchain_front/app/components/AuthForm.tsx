"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import Link from "next/link";
// 移除不存在的导入

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const { loginWithWallet } = useAuth();
  const router = useRouter();
  const qs = useSearchParams();
  const [email, setEmail] = useState(() => {
    // 从 localStorage 恢复已验证的邮箱
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('blockchain_verified_email');
      return saved || '';
    }
    return '';
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [needBind, setNeedBind] = useState(false);
  const [showToast, setShowToast] = useState(false);
  // 移除不需要的钱包验证状态
  const [emailVerified, setEmailVerified] = useState(() => {
    // 从 localStorage 恢复邮箱验证状态
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('blockchain_email_verified');
      return saved === 'true';
    }
    return false;
  });

  // 清理临时状态的函数
  const clearTemporaryState = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('blockchain_email_verified');
      window.localStorage.removeItem('blockchain_verified_email');
    }
  };

  // 钱包处理逻辑已整合到 onSubmit 中

  // 页面加载时恢复状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isVerified = window.localStorage.getItem('blockchain_email_verified') === 'true';
      const savedEmail = window.localStorage.getItem('blockchain_verified_email');
      
      if (isVerified && savedEmail) {
        setEmailVerified(true);
        setEmail(savedEmail);
      }
    }
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        // 第一步：仅验证邮箱（成功后变为“验证钱包”）
        if (!emailVerified) {
          if (!email) throw new Error("请输入邮箱");
          if (!emailSent) throw new Error("请先发送验证码");
          if (!emailCode) throw new Error("请输入验证码");
          await api.verifyEmailCode(email, emailCode);
          setEmailVerified(true);
          // 将邮箱验证状态保存到 localStorage
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('blockchain_email_verified', 'true');
            window.localStorage.setItem('blockchain_verified_email', email);
          }
          setShowToast(true);
          setTimeout(() => setShowToast(false), 2000);
          return; // 不继续执行，等待用户点击"验证钱包"
        }
        // 第二步：验证钱包并绑定
        try {
          await loginWithWallet("user", true); // 注册时传递 isRegistration=true
          const raw = window.localStorage.getItem("blockchain_auth_user_v1");
          const parsed = raw ? JSON.parse(raw) : null;
          const addr = parsed?.address;
          if (!addr) throw new Error("未检测到钱包地址");
          
          try {
            await api.registerBind(email, addr);
            // 注册成功后清除临时状态
            if (typeof window !== 'undefined') {
              window.localStorage.removeItem('blockchain_email_verified');
              window.localStorage.removeItem('blockchain_verified_email');
            }
          } catch (bindError: any) {
            // 如果是绑定失败，提供更具体的错误信息
            let errorMessage = bindError.message;
            if (bindError.message.includes("address already bound")) {
              errorMessage = "该钱包地址已被其他邮箱绑定，请使用其他钱包";
            } else if (bindError.message.includes("email already bound")) {
              errorMessage = "该邮箱已被其他钱包绑定，请使用其他邮箱";
            }
            throw new Error(errorMessage);
          }
        } catch (walletError: any) {
          // 如果是钱包连接失败，提供更友好的错误信息
          if (walletError.message.includes("User rejected")) {
            throw new Error("用户取消了钱包连接");
          } else if (walletError.message.includes("No Ethereum provider")) {
            throw new Error("未检测到钱包，请安装 MetaMask 或其他钱包");
          } else if (walletError.message.includes("address not registered")) {
            throw new Error("该钱包地址未注册，请先完成注册");
          }
          throw walletError;
        }
      } else {
        // 登录：直接钱包验证（如后端要求已绑定邮箱会返回错误）
        await loginWithWallet();
      }
      
      // 登录后按角色跳转（支持 returnTo 优先）
      const ret = qs?.get("returnTo");
      if (ret) {
        router.replace(ret);
      } else {
        // 注册完成后按需求跳转到 dashboard；登录保持原逻辑也可
        router.replace("/dashboard");
      }
    } catch (err: any) {
      let msg = err?.message ?? "操作失败";
      
      // 提供更明确的错误提示
      if (msg.includes("address already bound")) {
        msg = "该钱包地址已被其他邮箱绑定，请使用其他钱包或联系管理员";
      } else if (msg.includes("email already bound")) {
        msg = "该邮箱已被其他钱包绑定，请使用其他邮箱";
      } else if (msg.includes("email already registered")) {
        msg = "该邮箱已完成注册，请直接登录";
      } else if (msg.includes("address not registered")) {
        msg = "该钱包地址未注册，请先完成注册";
      } else if (msg.includes("email not registered")) {
        msg = "该邮箱未注册，请先完成注册";
      } else if (msg.includes("invalid signature")) {
        msg = "钱包签名验证失败，请重试";
      } else if (msg.includes("nonce missing/expired")) {
        msg = "验证码已过期，请重新获取";
      }
      
      setError(msg);
      if (mode === "login" && /email not registered/i.test(msg)) {
        setNeedBind(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSendCode = async () => {
    setError(null);
    try {
      if (!email) throw new Error("请输入邮箱");
      console.log("发送验证码到邮箱:", email);
      console.log("API Base URL:", process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080");
      
      // 测试 API 连接
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080"}/api/auth/email/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      console.log("API 响应状态:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("API 错误响应:", errorData);
        throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
      }
      
      const result = await response.json();
      console.log("API 成功响应:", result);
      
      setEmailSent(true);
      alert("验证码已发送（开发模式下后端日志会打印验证码）");
    } catch (e: any) {
      console.error("发送验证码失败:", e);
      let errorMessage = e?.message || "发送失败";
      
      // 提供更明确的错误提示
      if (errorMessage.includes("email already registered")) {
        errorMessage = "该邮箱已完成注册，请直接登录";
      } else if (errorMessage.includes("email required")) {
        errorMessage = "请输入邮箱地址";
      } else if (errorMessage.includes("HTTP 500")) {
        errorMessage = "服务器错误，请检查后端日志";
      } else if (errorMessage.includes("HTTP 409")) {
        errorMessage = "该邮箱已存在，请使用其他邮箱或直接登录";
      } else if (errorMessage.includes("Failed to fetch")) {
        errorMessage = "无法连接到服务器，请检查后端是否运行";
      }
      
      setError(errorMessage);
    }
  };

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 animate-fade-in" style={{ animationDelay: '.06s' }}>
      <div>
        <label className="block text-sm mb-1 text-white/70">邮箱</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md border border-white/15 bg-white/[0.02] px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#F5C542]/40"
          placeholder="you@example.com"
          required
        />
      </div>
      {mode === "register" && (
        <>
          <div className="flex items-center gap-2 animate-fade-in" style={{ animationDelay: '.08s' }}>
            <button type="button" onClick={onSendCode} className="px-3 py-2 rounded-md border border-white/15 bg-white/[0.04] text-white/90 transition hover:border-[#F5C542]/60">发送验证码</button>
            {emailSent && <span className="text-xs text-white/70">已发送，请查收邮箱或查看后端日志</span>}
          </div>
          <div>
            <label className="block text-sm mb-1 text-white/70">验证码</label>
            <input value={emailCode} onChange={(e) => setEmailCode(e.target.value)} disabled={emailVerified} className="w-full rounded-md border border-white/15 bg-white/[0.02] px-3 py-2 text-white placeholder-white/40 outline-none disabled:opacity-60" placeholder="四位数字" />
            {emailVerified && <p className="mt-1 text-xs text-[#F5C542]">邮箱已验证，请点击下方“验证钱包”完成注册</p>}
          </div>
        </>
      )}
      <div>
        <label className="block text-sm mb-1 text-white/70">密码</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-white/15 bg-white/[0.02] px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-[#F5C542]/40"
          placeholder="••••••••"
          required
        />
      </div>
      {/* 登录无需选择用户类型，角色由后端 token 决定；保留为只读提示或后续移除 */}
      {error && (
        <div className="p-3 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
          <div className="flex items-start">
            <svg className="w-4 h-4 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="font-medium">操作失败</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}
      {showToast && (
        <div className="fixed top-4 right-4 z-50 animate-[fadeIn_.2s_ease-out]">
          <div className="px-4 py-3 rounded-lg shadow-lg border border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-900">
            注册成功！欢迎加入。
          </div>
        </div>
      )}
      {needBind && (
        <div className="text-sm text-white/80">
          <span className="opacity-80">该钱包尚未绑定邮箱，请先完成注册绑定。</span>
          <button
            type="button"
            onClick={() => {
              const ret = qs?.get("returnTo");
              router.replace(`/register${ret ? `?returnTo=${encodeURIComponent(ret)}` : ""}`);
            }}
            className="ml-2 underline decoration-[#F5C542]/60 hover:decoration-[#F5C542]"
          >去注册</button>
        </div>
      )}
      
      {/* 钱包验证界面已整合到主流程中 */}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-[#F5C542] text-black py-2 font-medium transition hover:brightness-95 disabled:opacity-60"
      >
        {loading ? "处理中..." : mode === "login" ? "登录" : (emailVerified ? "验证钱包" : "注册")}
      </button>

      {/* 登录页在密码下方追加“连接钱包”按钮；成功后自动跳转 */}
      {mode === "login" && (
        <button
          type="button"
          className="w-full mt-2 rounded-md border border-white/15 bg-white/[0.04] text-white/90 py-2 transition hover:border-[#F5C542]/60"
          onClick={async () => {
            try {
              await loginWithWallet();
              const ret = qs?.get("returnTo");
              if (ret) router.replace(ret); else router.replace("/dashboard");
            } catch (e) {
              setError((e as any)?.message || "连接失败");
            }
          }}
        >连接钱包并进入仪表板</button>
      )}
    </form>
  );
}


