/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // The Paladar became the home page; /dashboard (and the older /stats)
    // redirect there so old bookmarks keep working.
    return [
      { source: "/dashboard", destination: "/", permanent: true },
      { source: "/stats", destination: "/", permanent: true },
    ];
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
