import type { NextConfig } from "next";

/**
 * API proxy strategy (production-grade):
 *
 * - Production / `next start` / Vercel: do NOT use next.config rewrites.
 *   Array-style rewrites run before App Router dynamic routes and bake the
 *   destination at build time. On Vercel that often becomes localhost:8080 →
 *   login 404. Traffic goes through `src/app/api/[...path]/route.ts`, which
 *   reads `API_PROXY_TARGET` at runtime.
 *
 * - Local `next dev` only: rewrite /api → local Spring Boot for a fast loop
 *   without requiring the route handler path.
 */
function devApiOrigin(): string {
  const raw =
    process.env.API_PROXY_TARGET ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "http://localhost:8080";
  return raw.replace(/\/+$/, "").replace(/\/api$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.NODE_ENV === "production") {
      return [];
    }
    const origin = devApiOrigin();
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
};

export default nextConfig;
