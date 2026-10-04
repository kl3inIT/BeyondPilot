/** Every request that changes state carries this header (docs/conventions.md › Published API contracts). */
const csrfHeader = { "X-BeyondPilot-CSRF": "1" };

type LinkRequestOutcome =
  | { kind: "sent" }
  | { kind: "invalid" }
  | { kind: "limited"; retryAfterMinutes: number }
  | { kind: "failed" };

type LinkRequest = { email: string; locale: string; returnTo?: string };

/** Asks the backend to email a sign-in link. The answer never says whether the address has an account. */
async function requestSignInLink({
  email,
  locale,
  returnTo,
}: LinkRequest): Promise<LinkRequestOutcome> {
  const form = new URLSearchParams({ username: email, locale });
  if (returnTo) {
    form.set("returnTo", returnTo);
  }
  let response: Response;
  try {
    response = await fetch("/ott/generate", { method: "POST", headers: csrfHeader, body: form });
  } catch {
    return { kind: "failed" };
  }
  if (response.status === 204) {
    return { kind: "sent" };
  }
  if (response.status === 400) {
    return { kind: "invalid" };
  }
  if (response.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    return { kind: "limited", retryAfterMinutes: Math.max(1, Math.ceil((seconds || 60) / 60)) };
  }
  return { kind: "failed" };
}

/** Redeems the token of an emailed link; on success the response sets the session cookie. */
async function redeemSignInLink(token: string): Promise<boolean> {
  try {
    const response = await fetch("/login/ott", {
      method: "POST",
      headers: csrfHeader,
      body: new URLSearchParams({ token }),
    });
    return response.status === 204;
  } catch {
    return false;
  }
}

/** Where the browser goes to start the Google round trip. */
function googleSignInPath(returnTo?: string) {
  return returnTo
    ? `/oauth2/authorization/google?${new URLSearchParams({ returnTo })}`
    : "/oauth2/authorization/google";
}

export { googleSignInPath, redeemSignInLink, requestSignInLink, type LinkRequestOutcome };
