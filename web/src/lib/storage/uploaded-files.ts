/**
 * The files this browser uploaded and a record does not name yet. The backend reads a file only
 * through the record that names it, so a person who has just uploaded a PDF reads it from their own
 * copy: an address of the page that lives until it is replaced, removed, or the tab closes. Browser
 * only.
 */
const uploaded = new Map<string, string>();

/** Keeps the copy of a file just uploaded, so that it can be opened at once. */
export function keepUploaded(fileId: string, file: Blob): void {
  forgetUploaded(fileId);
  uploaded.set(fileId, URL.createObjectURL(file));
}

/** Where the copy of an uploaded file is read, or `undefined` when this page did not upload it. */
export function uploadedAddress(fileId: string): string | undefined {
  return uploaded.get(fileId);
}

/** Lets go of the copy of a file that is replaced or removed. */
export function forgetUploaded(fileId: string): void {
  const address = uploaded.get(fileId);
  if (address !== undefined) {
    URL.revokeObjectURL(address);
    uploaded.delete(fileId);
  }
}

/**
 * Where a file is read to be opened: the copy this browser uploaded, else the address the record
 * that names it serves it at; `undefined` when there is neither.
 */
export function readableAddress(fileId: string, saved?: string): string | undefined {
  return uploadedAddress(fileId) ?? saved;
}
