/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@afyapoa/ui', '@afyapoa/config'],
};

export default nextConfig;
