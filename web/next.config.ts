import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Paths Spring owns. In deployed environments a reverse proxy in front of both apps routes them;
// during local development Next.js forwards them so the browser stays on one origin.
const springPaths = [
  "/api/:path*",
  "/login/:path*",
  "/logout",
  "/oauth2/:path*",
  "/ott/:path*",
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-protected-resource/:path*",
  "/mcp",
  "/mcp/:path*",
];

// Next.js renders inline scripts without a nonce, so scripts allow 'unsafe-inline'; what the policy
// holds firm is where scripts come from, no plugins, no <base> rewrite and no framing. Files are
// read from and uploaded to the S3 bucket, whose host differs per environment, hence https: for
// images, media, frames and connections. Dev mode needs eval for React's debugging.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com${
    process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
  }`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' blob: https:",
  "frame-src 'self' blob: https:",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactCompiler: true,
  images: {
    // 75 is the default; 90 is for portraits, whose skin and dark backdrops the default smooths away.
    qualities: [75, 90],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // Only the site, never the address of a page: a private address must not reach Google
          // Analytics as the referrer of the public page a person opens next.
          { key: "Referrer-Policy", value: "strict-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
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
