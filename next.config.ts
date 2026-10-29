import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      // Files are intentionally public: never apply public caching to /api or
      // authenticated HTML. Paths are stable, so use bounded revalidation.
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
      {
        source: '/ort/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
      {
        source: '/vendor/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
    ];
  },
};

export default nextConfig;
