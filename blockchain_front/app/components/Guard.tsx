"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth, UserRole } from "../context/AuthContext";

interface GuardProps {
  requireAuth?: boolean;
  requireRole?: UserRole;
  children: React.ReactNode;
}

export default function Guard({ requireAuth = false, requireRole, children }: GuardProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (isLoading) return; // 等待认证状态加载完成
    
    if (requireAuth && !isAuthenticated) {
      const ret = pathname + (search?.toString() ? `?${search?.toString()}` : "");
      router.replace(`/login?returnTo=${encodeURIComponent(ret)}`);
      return;
    }
    if (requireRole && user?.role !== requireRole) {
      // 非管理员访问管理员页时，仍应停留在登录页或显示无权限，而不是自动登录
      router.replace("/login");
    }
  }, [requireAuth, requireRole, isAuthenticated, isLoading, user, router]);

  return <>{children}</>;
}


