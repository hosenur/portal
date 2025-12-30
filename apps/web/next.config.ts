import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  serverExternalPackages: [],
  transpilePackages: ["elysia", "@opencode-ai/sdk"],
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
