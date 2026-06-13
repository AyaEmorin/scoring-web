import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // จำเป็นสำหรับ Cloudflare Pages
  experimental: {
    after: false,
  },
};

export default nextConfig;
