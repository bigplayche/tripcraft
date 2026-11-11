import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TripCraft is almost entirely per-user, request-time UI, so we use the
  // classic dynamic rendering model instead of Cache Components.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
