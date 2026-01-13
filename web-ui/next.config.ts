import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // API requests are proxied through /api/[...path]/route.ts instead of rewrites
  // This allows proper certificate handling and cookie forwarding

  // Performance optimizations
  reactStrictMode: true,

  // Experimental features for better performance
  experimental: {
    // Enable optimized package imports for common packages
    optimizePackageImports: [
      'lucide-react',
      'react-markdown',
      'remark-gfm',
      '@heroicons/react',
    ],
  },

  // Empty turbopack config to silence the warning in Next.js 16+
  // Turbopack is now the default bundler for dev mode
  turbopack: {},

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/avif', 'image/webp'],
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,
};

export default nextConfig;
