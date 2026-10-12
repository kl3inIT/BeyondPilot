import { describe, expect, it } from "vitest";

import { validEndpoint } from "./provider-endpoint";

describe("validEndpoint", () => {
  it.each([
    "https://openrouter.ai/api/v1",
    "http://localhost:20128/v1",
    "http://10.0.0.12:8080",
    "HTTPS://api.example.com/v1/",
    "http://[::1]:11434/v1",
    "http://gateway.internal",
  ])("takes %s", (url) => {
    expect(validEndpoint(url)).toBe(true);
  });

  it.each([
    ["nothing", ""],
    ["words", "not a url"],
    ["a host without a scheme", "openrouter.ai/api/v1"],
    ["another scheme", "ftp://example.com/v1"],
    ["a scheme without a host", "https://"],
    ["space around it", " https://example.com/v1"],
    ["a space inside it", "https://example.com/v 1"],
    ["credentials", "https://user:secret@example.com/v1"],
    ["an empty user part", "https://@example.com/v1"],
    ["a query", "https://example.com/v1?key=secret"],
    ["an empty query", "https://example.com/v1?"],
    ["a fragment", "https://example.com/v1#top"],
    ["a link-local host", "http://169.254.169.254/latest"],
    ["a link-local IPv6 host", "http://[fe80::1]/v1"],
    ["the AWS metadata service over IPv6", "http://[fd00:ec2::254]/latest"],
    ["more than 2048 characters", `https://example.com/${"a".repeat(2048)}`],
  ])("refuses %s", (_what, url) => {
    expect(validEndpoint(url)).toBe(false);
  });
});
