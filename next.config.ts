import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server code (lookup API, bill/official pages) reads these JSON files with
  // fs at runtime — make sure they're bundled into the serverless functions.
  outputFileTracingIncludes: {
    "/**": ["./public/data/**"],
  },
};

export default nextConfig;
