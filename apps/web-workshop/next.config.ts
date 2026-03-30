import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  transpilePackages: ['@mecanix/types', '@mecanix/validators'],
  // TODO: Remove once all ~100 TS errors are fixed (mostly Record<string, unknown> casts).
  // Run `pnpm --filter web-workshop typecheck` to see the full list.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default withNextIntl(nextConfig);
