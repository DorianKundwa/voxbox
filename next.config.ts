import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Required for AudioWorklet + SharedArrayBuffer
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  // Allow backend API calls in development
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api-proxy/:path*",
            destination: "http://localhost:8000/:path*",
          },
        ]
      : [];
  },
};

export default nextConfig;
