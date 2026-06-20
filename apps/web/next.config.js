/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
};

module.exports = nextConfig;
