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

  // Note: Using webpack instead of Turbopack due to known 404 issues with sub-pages
  // See: https://github.com/vercel/next.js/issues/81271
  // Turbopack can be enabled with: npm run dev:turbo

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
