import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: {
      // Raise from the 1 MB default so CSV contact imports work.
      // Note: Vercel serverless caps request bodies at ~4.5 MB; larger
      // imports should be chunked client-side.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
