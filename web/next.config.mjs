/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // O Paladar virou a página inicial; os atalhos antigos continuam funcionando.
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
