import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pas/shared"],
  async rewrites() {
    const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:3001";
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
