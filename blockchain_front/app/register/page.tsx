import AuthForm from "../components/AuthForm";
import { Suspense } from "react";

export default function RegisterPage() {
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

      <div className="relative max-w-7xl mx-auto px-4 animate-fade-in">
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center py-12 animate-slide-up">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.04] p-8 text-white">
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-[#F5C542] to-[#8c6a1f] bg-clip-text text-transparent">创建账户</span>
              </h1>
              <p className="text-sm text-white/70">注册并绑定钱包开始体验</p>
            </div>
            <div className="mt-6 animate-fade-in" style={{ animationDelay: '.08s' }}>
              <Suspense fallback={<div className="text-white/70">加载中...</div>}>
                <AuthForm mode="register" />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


