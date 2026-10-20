import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetUploaded, keepUploaded, readableAddress, uploadedAddress } from "./uploaded-files";

describe("uploaded files", () => {
  afterEach(() => {
    forgetUploaded("a");
    forgetUploaded("b");
    vi.restoreAllMocks();
  });

  it("opens a file just uploaded from the browser's own copy", () => {
    const create = vi.fn(() => "blob:copy-a");
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });

    keepUploaded("a", new Blob(["%PDF-"]));

    expect(uploadedAddress("a")).toBe("blob:copy-a");
    expect(readableAddress("a", "/api/saved")).toBe("blob:copy-a");
    vi.unstubAllGlobals();
  });

  it("falls back to the address of the record, and to nothing without either", () => {
    expect(readableAddress("b", "/api/saved")).toBe("/api/saved");
    expect(readableAddress("b")).toBeUndefined();
  });

  it("lets go of the copy of a file that is replaced or removed", () => {
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "blob:copy-b", revokeObjectURL: revoke });

    keepUploaded("b", new Blob(["%PDF-"]));
    forgetUploaded("b");

    expect(revoke).toHaveBeenCalledWith("blob:copy-b");
    expect(uploadedAddress("b")).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("keeps one copy of a file kept twice", () => {
    const revoke = vi.fn();
    let count = 0;
    vi.stubGlobal("URL", { createObjectURL: () => `blob:${++count}`, revokeObjectURL: revoke });

    keepUploaded("a", new Blob(["1"]));
    keepUploaded("a", new Blob(["2"]));

    expect(revoke).toHaveBeenCalledWith("blob:1");
    expect(uploadedAddress("a")).toBe("blob:2");
    vi.unstubAllGlobals();
  });
});
