import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
    ];
  },
};

export default nextConfig;
