import { readableAddress } from "@/lib/storage/uploaded-files";

/** A PDF attachment the page can open: what the viewer needs, and which attachment it is. */
export type OpenablePdf = { id: string; url: string; name: string; meta: string };

/** Whether a file is a PDF, which is what opens in the page; any other kind keeps its own way. */
export function isPdf(mediaType: string): boolean {
  return mediaType.toLowerCase() === "application/pdf";
}

/**
 * The PDFs among the files of a use case that can be opened: the copy this browser just uploaded, or
 * the address of the use case that names the file, `<path>/<file id>`. A file with neither, such as
 * one of a use case that is not saved yet and was not uploaded here, cannot be opened.
 */
export function openablePdfs(
  files: { id: string; fileName: string; mediaType: string; sizeBytes: number }[],
  filesPath: string | undefined,
  metaOf: (sizeBytes: number) => string,
): OpenablePdf[] {
  return files.flatMap((file) => {
    const url = isPdf(file.mediaType)
      ? readableAddress(file.id, filesPath === undefined ? undefined : `${filesPath}/${file.id}`)
      : undefined;
    return url === undefined
      ? []
      : [{ id: file.id, url, name: file.fileName, meta: metaOf(file.sizeBytes) }];
  });
}

/** Where the members of an organization read the files of one of its use cases. */
export function myAttachmentsPath(useCaseId: string): string {
  return `/api/usecase/mine/${useCaseId}/attachments`;
}

/** Where an operator reads the files of a use case. */
export function adminAttachmentsPath(useCaseId: string): string {
  return `/api/usecase/admin/use-cases/${useCaseId}/attachments`;
}
