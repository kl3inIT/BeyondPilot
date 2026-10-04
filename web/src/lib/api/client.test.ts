import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "./client";
import { getMe } from "./generated";
import { client } from "./generated/client.gen";

/** Stands in for the network: every request gets this answer, and the requests made are returned. */
function answerWith(respond: () => Response | Promise<Response>) {
  const requests: { url: string; method: string; headers: Headers }[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    });
    return respond();
  });
  return requests;
}

async function failureOf(call: Promise<unknown>) {
  const failure = await call.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(ApiError);
  return failure as ApiError;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the generated API client", () => {
  it("returns the data of a successful answer", async () => {
    const me = { id: "6f1c3a52-0f0e-4a53-9a55-0d3f6f6b7a01", email: "a@example.com", role: "user" };
    answerWith(() => Response.json(me));

    const { data } = await getMe();

    expect(data).toEqual(me);
  });

  it("rejects a problem answer with its status, code, request id and violations", async () => {
    const problem = {
      status: 400,
      title: "Bad Request",
      code: "REQUEST_INVALID",
      requestId: "0b0f6a52-1d8e-4c0e-9d0a-5a7c1e2f3a44",
      errors: [{ pointer: "#/title", code: "NOT_BLANK", detail: "must not be blank" }],
    };
    answerWith(
      () =>
        new Response(JSON.stringify(problem), {
          status: 400,
          headers: { "Content-Type": "application/problem+json" },
        }),
    );

    const failure = await failureOf(getMe());

    expect(failure.status).toBe(400);
    expect(failure.code).toBe("REQUEST_INVALID");
    expect(failure.requestId).toBe(problem.requestId);
    expect(failure.violations).toEqual(problem.errors);
  });

  it("keeps the status of a failure whose body is not a problem", async () => {
    answerWith(() => new Response("<html>Bad Gateway</html>", { status: 502 }));

    const failure = await failureOf(getMe());

    expect(failure.status).toBe(502);
    expect(failure.code).toBeUndefined();
    expect(failure.violations).toEqual([]);
  });

  it("rejects without a status when no answer comes", async () => {
    answerWith(() => Promise.reject(new TypeError("fetch failed")));

    const failure = await failureOf(getMe());

    expect(failure.status).toBeUndefined();
  });

  it("sends the CSRF header with a request that changes state, and not with a read", async () => {
    const requests = answerWith(() => new Response(null, { status: 204 }));

    await client.post({ url: "/api/anything" });
    await client.get({ url: "/api/anything" });

    expect(requests.map((request) => request.headers.get("X-BeyondPilot-CSRF"))).toEqual([
      "1",
      null,
    ]);
  });
});
