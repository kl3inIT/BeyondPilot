import { ApiError } from "@/lib/api/client";
import {
  confirmUpload,
  reserveUpload,
  type ReserveUpload,
  type StoredFile,
} from "@/lib/api/generated";

/**
 * Uploads a file in the three requests the backend asks for: reserve it, send the bytes where the
 * ticket says, confirm it. With the local store the ticket points back at the backend; with S3 it is
 * a presigned address of the bucket, so the bytes never pass through the application. The ticket
 * carries every header its address needs. Browser only.
 * @throws ApiError when the backend refuses the file, the store refuses the bytes, or no answer came
 */
export async function uploadFile(
  file: File,
  purpose: ReserveUpload["purpose"],
): Promise<StoredFile> {
  const { data: ticket } = await reserveUpload({
    body: { purpose, fileName: file.name, mediaType: file.type, sizeBytes: file.size },
  });
  let sent: Response;
  try {
    sent = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: file });
  } catch (cause) {
    throw new ApiError(undefined, undefined, cause);
  }
  if (!sent.ok) {
    // A bucket answers in XML, not with a problem; the status is what matters.
    throw new ApiError(sent.status, undefined);
  }
  const { data } = await confirmUpload({ path: { id: ticket.id } });
  return data;
}

/** The address a public file, such as a program's cover, is read at. */
export function publicFileUrl(id: string) {
  return `/api/storage/files/${id}`;
}
