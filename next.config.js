/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js not to bundle sharp — load it at runtime so Vercel
  // uses its own pre-installed Linux x64 native binaries instead of
  // the Windows binaries bundled during npm install.
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
      {
        protocol: 'https',
        hostname: '**.runninghub.cn',
      },
      {
        protocol: 'https',
        hostname: '**.runninghub.ai',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: '**.myqcloud.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

module.exports = nextConfig;

