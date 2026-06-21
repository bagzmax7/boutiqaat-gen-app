/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
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
    ],
  },
};

module.exports = nextConfig;
