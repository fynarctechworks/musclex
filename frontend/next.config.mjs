import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Note: Permissions-Policy + security headers are owned by src/middleware.ts
  // (the edge middleware runs after next.config headers and would override
  // anything set here, so we keep a single source of truth).
  experimental: {
    serverComponentsExternalPackages: ['@opentelemetry/api', '@opentelemetry/core', '@opentelemetry/semantic-conventions'],
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'date-fns',
      'zod',
    ],
  },
  modularizeImports: {
    'date-fns': {
      transform: 'date-fns/{{member}}',
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
});
