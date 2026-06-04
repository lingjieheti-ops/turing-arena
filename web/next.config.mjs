/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@turing-arena/shared"],
  // No ESLint config is shipped (keeps deps lean); don't fail the build on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
