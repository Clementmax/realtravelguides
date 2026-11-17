import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Defaults are 640, 750, 828, 1080, 1200, 1920, 2048, 3840.
    // 1280 keeps a desktop article column from jumping to 1920.
    deviceSizes: [640, 750, 828, 1080, 1200, 1280, 1920, 2048, 3840],
    // Documented long TTL for resized files. Upstream Cache-Control can only raise it.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        // Wildcard rather than a hardcoded project ref, so this keeps
        // working even if the Supabase project URL ever changes.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // Old homepage "Explore" links used /category/[slug]; category pages now
  // live under /journeysbyrail/categories/[slug].
  async redirects() {
    return [
      {
        source: "/category/fooddrink",
        destination: "/journeysbyrail",
        permanent: true,
      },
      {
        source: "/category/hiddenplaces",
        destination: "/journeysbyrail",
        permanent: true,
      },
      {
        source: "/journeysbyrail/categories/fooddrink",
        destination: "/journeysbyrail",
        permanent: true,
      },
      {
        source: "/journeysbyrail/categories/hiddenplaces",
        destination: "/journeysbyrail",
        permanent: true,
      },
      {
        source: "/category/:slug",
        destination: "/journeysbyrail/categories/:slug",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "/journeysbyrail",
        permanent: true,
      },
      {
        source: "/journeysbyrail/categories/exhibitions",
        destination: "/journeysbyrail/categories/culture",
        permanent: true,
      },
      {
        source: "/copy-of-books",
        destination: "/sophiepicot",
        permanent: true,
      },
      {
        source: "/copy-of-sophie-picot",
        destination: "/elenarossetti",
        permanent: true,
      },
      {
        source:
          "/post/porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train-1",
        destination:
          "/post/porto-ercole-weekend-getaway-beaches-forts-from-rome-by-train",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
