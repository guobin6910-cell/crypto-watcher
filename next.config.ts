import type { NextConfig } from "next";

const repo = "crypto-watcher";

const nextConfig: NextConfig = {
  output: "export",
  basePath: `/${repo}`,
  assetPrefix: `/${repo}`,
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
