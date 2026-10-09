import { getOcrSettings, type OcrSettings } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** The OCR providers and what reads document pages, for the operator behind this request. Server only. */
export async function readOcrSettings(): Promise<OcrSettings> {
  const { data } = await getOcrSettings(await sessionRequest());
  return data;
}
