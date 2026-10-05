import { ApiError } from "./client";

/**
 * The members of a request the backend rejected, by name. A problem points at each with a JSON
 * Pointer; `#/roles/0` and `#/roles` both name the field `roles`.
 */
export function rejectedFields(error: unknown): Set<string> {
  if (!(error instanceof ApiError)) {
    return new Set();
  }
  return new Set(
    error.violations
      .map((violation) => violation.pointer.replace(/^#?\//, "").split("/")[0])
      .filter((field) => field !== ""),
  );
}
