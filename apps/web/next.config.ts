import type { NextConfig } from "next";

const defaultApiBaseUrl =
  process.env.NODE_ENV === "production" ? "http://pas-api:3001" : "http://localhost:3001";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@pas/shared"],
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? defaultApiBaseUrl;
    return [
      {
        source: "/api/:path*",
        destination: `${apiBaseUrl}/api/:path*`,
      },
      {
        source: "/auth/:path*",
        destination: `${apiBaseUrl}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
