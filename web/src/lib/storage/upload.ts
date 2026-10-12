import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import type { FailureWords } from "@/lib/api/failure";
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

/**
 * What an upload field says when its file is refused: the field's own words where it can name the
 * kinds and the size it takes, the words of the code for any other refusal, and `failed` when the
 * file simply did not arrive.
 */
export function uploadWords(own: {
  type: MessageKey;
  size: MessageKey;
  failed: MessageKey;
}): FailureWords {
  return {
    STORAGE_MEDIA_TYPE_NOT_ALLOWED: own.type,
    STORAGE_CONTENT_MISMATCH: own.type,
    STORAGE_FILE_TOO_LARGE: own.size,
    otherwise: own.failed,
  };
}

/** The address a public file, such as a program's cover, is read at. */
export function publicFileUrl(id: string) {
  return `/api/storage/files/${id}`;
}
