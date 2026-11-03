import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server side at all — pure static export, runs off localStorage
  output: "export",
  trailingSlash: true,
};

export default nextConfig;