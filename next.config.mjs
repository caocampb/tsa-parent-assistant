/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Fix for pdf-parse trying to load test files
    config.resolve.alias = {
      ...config.resolve.alias,
      "fs": false,
      "path": false,
    };
    
    // Ignore pdf-parse test files
    config.module.rules.push({
      test: /\.pdf$/,
      type: 'asset/source'
    });
    
    return config;
  },
};

export default nextConfig;
