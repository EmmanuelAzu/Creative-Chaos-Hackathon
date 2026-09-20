/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  async redirects() {
    return [
      { source: "/certificate", destination: "/certificates", permanent: true },
    ];
  },
};

module.exports = nextConfig;
