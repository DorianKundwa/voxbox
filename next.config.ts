import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for AudioWorklet SharedArrayBuffer + WASM
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",  value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
          { key: "X-Content-Type-Options",       value: "nosniff" },
        ],
      },
    ];
  },

  // Dev: proxy /api/* → FastAPI backend at :8000
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source:      "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
