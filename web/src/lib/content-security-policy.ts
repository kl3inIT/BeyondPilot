/** The request header that carries the nonce of the page being rendered, set by `src/proxy.ts`. */
export const nonceHeader = "x-nonce";

/**
 * The Content-Security-Policy of a page. Scripts run only with the nonce of this response, and what
 * such a script loads after it ('strict-dynamic'), so a script injected into the HTML does not run;
 * Next.js puts the nonce on its own scripts. Styles stay 'unsafe-inline': components set inline
 * `style` attributes, which a nonce cannot cover, and an injected style is far less dangerous.
 * Files are read from and uploaded to the S3 bucket, whose host differs per environment, hence
 * https: for images, media, frames and connections. Dev mode needs eval for React's debugging.
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "media-src 'self' blob: https:",
    "frame-src 'self' blob: https:",
    // A file picked but not yet uploaded is read by PDF.js from a blob: address the page made.
    "connect-src 'self' https: blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** A fresh nonce for one response. */
export function newNonce(): string {
  return btoa(crypto.randomUUID());
}
