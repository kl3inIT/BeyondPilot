import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the AI screens can meet, each with its own words in the catalog. */
const known = [
  "SEARCH_PROVIDER_NOT_FOUND",
  "SEARCH_PROVIDER_INVALID",
  "SEARCH_PROVIDER_NAME_TAKEN",
  "SEARCH_PROVIDER_CHANGED",
  "SEARCH_PROVIDER_IN_USE",
  "SEARCH_PROVIDER_KEY_MISSING",
  "SEARCH_MODEL_UNKNOWN",
  "SEARCH_MODEL_REJECTED",
  "SEARCH_RETRY_ITEM_INCOMPLETE",
  "SEARCH_SETTINGS_CHANGED",
  "SEARCH_ENCRYPTION_KEY_MISSING",
] as const;

/** The words for a failed request of Admin › AI: by its code when the screen knows it, general otherwise. */
export function aiError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Admin.ai.errors.${match}` : "Admin.ai.errors.unknown";
}
