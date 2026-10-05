import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Paths Spring owns. In deployed environments a reverse proxy in front of both apps routes them;
// during local development Next.js forwards them so the browser stays on one origin.
const springPaths = ["/api/:path*", "/login/:path*", "/logout", "/oauth2/:path*", "/ott/:path*"];

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  experimental: {
    // Tailwind's stylesheet is small and most visitors arrive for the first time, so it rides in the
    // HTML instead of blocking the first paint as a separate request.
    inlineCss: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }
    const apiOrigin = process.env.BEYONDPILOT_API_ORIGIN;
    if (!apiOrigin) {
      throw new Error(
        "BEYONDPILOT_API_ORIGIN must be set for local development; see .env.development.",
      );
    }
    return springPaths.map((source) => ({ source, destination: `${apiOrigin}${source}` }));
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
