import { ApiError } from "./client";

/**
 * The members of a request the backend rejected, by name. A problem points at each with a JSON
 * Pointer; `#/roles/0` and `#/roles` both name the field `roles`. A request that holds the form's
 * fields under one member says which with `within`: `#/profile/name` then names `name`.
 */
export function rejectedFields(error: unknown, within?: string): Set<string> {
  if (!(error instanceof ApiError)) {
    return new Set();
  }
  return new Set(
    error.violations
      .map((violation) => violation.pointer.replace(/^#?\//, "").split("/"))
      .map((path) => (within !== undefined && path[0] === within ? path[1] : path[0]) ?? "")
      .filter((field) => field !== ""),
  );
}
