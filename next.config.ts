import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Set the turbopack root to avoid symlink issues
  turbopack: {
    root: path.resolve(__dirname),
  },
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site', '192.168.0.208', 'localhost', '127.0.0.1', '[240e:3bb:2cc1:9b20:f3e6:4c98:7464:83f8]', 'shanze.hppro1.hpnu.cn'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
