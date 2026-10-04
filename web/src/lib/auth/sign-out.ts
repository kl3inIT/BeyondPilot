import { csrfHeader } from "@/lib/api/client";

/**
 * Ends the session at the backend. Browser only. Signing out changes state, so it is a POST with
 * the header every such request carries (docs/conventions.md › Published API contracts).
 */
export async function signOut(): Promise<boolean> {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: csrfHeader,
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
