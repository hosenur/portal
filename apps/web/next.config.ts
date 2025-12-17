import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: [],
  transpilePackages: ["elysia", "@opencode-ai/sdk"],
};

export default nextConfig;
