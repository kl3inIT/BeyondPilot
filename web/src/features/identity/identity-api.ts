/** Every request that changes state carries this header (docs/conventions.md › Published API contracts). */
const csrfHeader = { "X-BeyondPilot-CSRF": "1" };

type CodeRequestOutcome =
  | { kind: "sent" }
  | { kind: "invalid" }
  | { kind: "limited"; retryAfterMinutes: number }
  | { kind: "failed" };

type CodeRequest = { email: string; locale: string };

/**
 * Asks the backend to email a sign-in code. The answer never says whether the address has an
 * account. The backend ties the code to this browser's session, so only this browser can use it.
 */
async function requestSignInCode({ email, locale }: CodeRequest): Promise<CodeRequestOutcome> {
  let response: Response;
  try {
    response = await fetch("/ott/generate", {
      method: "POST",
      headers: csrfHeader,
      body: new URLSearchParams({ username: email, locale }),
    });
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

/**
 * What the backend made of a typed code: `wrong` can be tried again, `expired` and `locked` need a
 * new code, `disabled` is an account that may not sign in, `failed` is a request that did not get
 * an answer.
 */
type CodeCheckOutcome = "signed-in" | "wrong" | "expired" | "locked" | "disabled" | "failed";

const codeCheckByStatus: Record<number, CodeCheckOutcome> = {
  204: "signed-in",
  401: "wrong",
  410: "expired",
  429: "locked",
  403: "disabled",
};

/** Checks a typed code; on success the response sets the session cookie. */
async function verifySignInCode(code: string): Promise<CodeCheckOutcome> {
  try {
    const response = await fetch("/login/ott", {
      method: "POST",
      headers: csrfHeader,
      body: new URLSearchParams({ code }),
    });
    return codeCheckByStatus[response.status] ?? "failed";
  } catch {
    return "failed";
  }
}

/** Where the browser goes to start the Google round trip. */
function googleSignInPath(returnTo?: string) {
  return returnTo
    ? `/oauth2/authorization/google?${new URLSearchParams({ returnTo })}`
    : "/oauth2/authorization/google";
}

export {
  googleSignInPath,
  requestSignInCode,
  verifySignInCode,
  type CodeCheckOutcome,
  type CodeRequestOutcome,
};
