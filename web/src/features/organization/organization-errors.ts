import type { MessageKey } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";

/** The refusals the organization screens can meet, each with its own words in the catalog. */
const known = [
  "ORGANIZATION_NOT_FOUND",
  "ORGANIZATION_LOGO_NOT_USABLE",
  "ORGANIZATION_MEMBERSHIP_REQUIRED",
  "ORGANIZATION_OWNER_REQUIRED",
  "ORGANIZATION_ALREADY_MEMBER",
  "ORGANIZATION_REQUEST_PENDING",
  "ORGANIZATION_INVITATION_NOT_FOUND",
  "ORGANIZATION_REQUEST_NOT_FOUND",
  "ORGANIZATION_MEMBER_NOT_FOUND",
  "ORGANIZATION_ALREADY_INVITED",
  "ORGANIZATION_INVITEE_IS_MEMBER",
  "ORGANIZATION_LAST_OWNER",
  "ORGANIZATION_CHANGED_MEANWHILE",
  "ORGANIZATION_NOT_AWAITING_REVIEW",
  "ORGANIZATION_DOMAIN_TAKEN",
  "ORGANIZATION_DOMAIN_NOT_VERIFIED",
  "ORGANIZATION_NOT_APPROVED",
  "ORGANIZATION_INVITATION_DAILY_LIMIT",
  "ORGANIZATION_INVITATION_OPEN_LIMIT",
  "REQUEST_INVALID",
] as const;

/** The words for a failed organization request: by its code when the screen knows it, general otherwise. */
export function organizationError(error: unknown): MessageKey {
  const code = error instanceof ApiError ? error.code : undefined;
  const match = known.find((candidate) => candidate === code);
  return match ? `Organization.errors.${match}` : "Organization.errors.unknown";
}
