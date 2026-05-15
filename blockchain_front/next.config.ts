import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 指定追踪根目录，避免因上层 lockfile 误判工作区
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
