import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, newNonce } from "./content-security-policy";

describe("contentSecurityPolicy", () => {
  it("runs only the scripts of this response, and what they load", () => {
    const policy = contentSecurityPolicy("abc", false);
    expect(policy).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    // PDF.js reads a file picked but not yet uploaded from a blob: address.
    expect(policy).toContain("connect-src 'self' https: blob: data:");
  });

  it("lets React's debugging use eval in development only", () => {
    expect(contentSecurityPolicy("abc", true)).toContain("'strict-dynamic' 'unsafe-eval'");
  });

  it("makes a different nonce for each response", () => {
    expect(newNonce()).not.toBe(newNonce());
  });
});
