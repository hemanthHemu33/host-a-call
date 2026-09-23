import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@connecto/design-tokens', '@connecto/domain'],
  turbopack: {
    root: join(process.cwd(), '../..'),
  },
};

export default nextConfig;
