import type { Page } from "@playwright/test";

/** A PNG of one pixel: what stands for any image in these tests. */
export const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Answers the public address of stored files with an image, as the backend serves a logo or a cover. */
export async function serveStoredImages(page: Page) {
  await page.route("**/api/storage/files/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixel }),
  );
}

type Reserved = { purpose: string; fileName: string; mediaType: string; sizeBytes: number };

/**
 * Answers the three requests of an upload as the backend would, each file under the next of the
 * given identifiers. Returns what was reserved, in order.
 */
export async function answerUploads(page: Page, ids: string[]): Promise<Reserved[]> {
  const reserved: Reserved[] = [];
  await page.route("**/api/storage/uploads", async (route) => {
    const id = ids[reserved.length];
    reserved.push(route.request().postDataJSON() as Reserved);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        method: "PUT",
        url: `/api/storage/uploads/${id}/content?token=once`,
        headers: {},
        expiresAt: "2026-10-03T08:00:00Z",
      }),
    });
  });
  await page.route("**/api/storage/uploads/*/content**", (route) => route.fulfill({ status: 204 }));
  await page.route("**/api/storage/uploads/*/confirm", async (route) => {
    const id = new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
    const file = reserved[ids.indexOf(id)];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id,
        fileName: file.fileName,
        mediaType: file.mediaType,
        sizeBytes: file.sizeBytes,
      }),
    });
  });
  return reserved;
}
