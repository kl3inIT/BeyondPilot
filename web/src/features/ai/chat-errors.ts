import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the Chat tab can meet, each with its own words in the catalog. */
const known = [
  "AI_PROVIDER_NOT_FOUND",
  "AI_PROVIDER_NAME_TAKEN",
  "AI_PROVIDER_CHANGED",
  "AI_PROVIDER_IN_USE",
  "AI_PROVIDER_KEY_MISSING",
  "AI_ENCRYPTION_KEY_MISSING",
  "AI_PROVIDER_ENDPOINT_INVALID",
  "AI_PROVIDER_ADAPTER_UNKNOWN",
  "AI_PROVIDER_CREDENTIAL_REJECTED",
  "AI_PROVIDER_UNREACHABLE",
  "AI_PROVIDER_INCOMPATIBLE",
  "AI_MODEL_NOT_FOUND",
  "AI_MODEL_NAME_TAKEN",
  "AI_MODEL_CHANGED",
  "AI_MODEL_INVALID",
  "AI_MODEL_UNAVAILABLE",
  "AI_MODEL_WITHOUT_VISION",
  "AI_TASK_UNKNOWN",
  "AI_TASK_CHANGED",
  "AI_BUSY",
] as const;

/** The words for a failed request of the Chat tab: by its code when the screen knows it, general otherwise. */
export function chatError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Admin.ai.chat.errors.${match}` : "Admin.ai.chat.errors.unknown";
}
