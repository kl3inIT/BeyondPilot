/**
 * Ends the session at the backend. Browser only. Signing out changes state, so it is a POST with
 * the header every such request carries (docs/conventions.md › Published API contracts).
 */
export async function signOut(): Promise<boolean> {
  try {
    const response = await fetch("/logout", {
      method: "POST",
      headers: { "X-BeyondPilot-CSRF": "1" },
    });
    return response.status === 204;
  } catch {
    return false;
  }
}
