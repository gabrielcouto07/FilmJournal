/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // /stats was merged into /dashboard (Paladar); keep old bookmarks working.
    return [{ source: "/stats", destination: "/dashboard", permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
