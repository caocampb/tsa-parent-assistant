import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    serverComponentsExternalPackages: ['tiktoken'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('tiktoken');
    }
    return config;
  },
};

export default nextConfig;
