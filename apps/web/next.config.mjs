/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/supichat',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '/supichat',
  reactStrictMode: true,
  experimental: {
    turbo: false, // Disable Turbopack which might cause CSS issues
  },
};
export default nextConfig;




