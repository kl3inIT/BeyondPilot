import { afterEach, describe, expect, it, vi } from "vitest";

import { forgetUploaded, keepUploaded } from "@/lib/storage/uploaded-files";

import {
  adminAttachmentsPath,
  isPdf,
  myAttachmentsPath,
  openablePdfs,
} from "./use-case-attachment-files";

const pdf = { id: "p", fileName: "samples.pdf", mediaType: "application/pdf", sizeBytes: 2048 };
const sheet = {
  id: "s",
  fileName: "data.csv",
  mediaType: "text/csv",
  sizeBytes: 10,
};
const meta = (bytes: number) => `${bytes} B`;

describe("isPdf", () => {
  it("takes the PDF media type in any case, and nothing else", () => {
    expect(isPdf("application/pdf")).toBe(true);
    expect(isPdf("Application/PDF")).toBe(true);
    expect(isPdf("text/csv")).toBe(false);
    expect(isPdf("image/png")).toBe(false);
  });
});

describe("openablePdfs", () => {
  afterEach(() => {
    forgetUploaded("p");
    vi.unstubAllGlobals();
  });

  it("opens a saved PDF at the address of its use case, and leaves other kinds to their own way", () => {
    expect(openablePdfs([pdf, sheet], "/api/usecase/mine/u1/attachments", meta)).toEqual([
      { id: "p", url: "/api/usecase/mine/u1/attachments/p", name: "samples.pdf", meta: "2048 B" },
    ]);
  });

  it("cannot open a PDF of a use case that is not saved, unless this page uploaded it", () => {
    expect(openablePdfs([pdf], undefined, meta)).toEqual([]);

    vi.stubGlobal("URL", { createObjectURL: () => "blob:p", revokeObjectURL: vi.fn() });
    keepUploaded("p", new Blob(["%PDF-"]));

    expect(openablePdfs([pdf], undefined, meta)).toEqual([
      { id: "p", url: "blob:p", name: "samples.pdf", meta: "2048 B" },
    ]);
  });
});

describe("attachment paths", () => {
  it("name the use case's own files under the controller that serves them", () => {
    expect(myAttachmentsPath("u1")).toBe("/api/usecase/mine/u1/attachments");
    expect(adminAttachmentsPath("u1")).toBe("/api/usecase/admin/use-cases/u1/attachments");
  });
});
