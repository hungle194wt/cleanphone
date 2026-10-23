import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server treats 127.0.0.1 as cross-origin unless it is listed here.
  allowedDevOrigins: ["127.0.0.1"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
