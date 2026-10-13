import { expect, test, type Page } from "@playwright/test";

import { expectNoSeriousA11yViolations } from "./axe";
import { signInAs } from "./session";

const stubOrigin = "http://localhost:3190";
const messages = "/workspace/messages";

const arifChat = "c0a1b2c3-0001-4d5e-8f90-a1b2c3d4e501";
const haRequest = "c0a1b2c3-0003-4d5e-8f90-a1b2c3d4e503";

type Written = { call: string; body: unknown };

/**
 * Sends what the browser asks of Messages to the stub backend, the stream of events included, and
 * returns what it wrote there (everything but a read), each with what it carried.
 */
async function answerMessaging(page: Page) {
  const written: Written[] = [];
  await page.route("**/api/messaging/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      expect(request.headers()["x-beyondpilot-csrf"]).toBe("1");
      written.push({ call: `${request.method()} ${url.pathname}`, body: request.postDataJSON() });
    }
    await route.continue({ url: `${stubOrigin}${url.pathname}${url.search}` });
  });
  return written;
}

/** The name at the head of the open conversation; the column beside it says the name again. */
function title(page: Page, name: string) {
  return page.getByRole("heading", { level: 2, name }).first();
}

/** The conversations of the list that is shown, by who each is with. */
function rows(page: Page, list: "Chats" | "Requests") {
  return page.getByRole("list", { name: list }).getByRole("button");
}

test.describe("messages", () => {
  test.use({ locale: "en-US" });

  test("a visitor is sent to sign in and back, to the first message they meant to write", async ({
    page,
  }) => {
    const list = await page.request.get(messages, { maxRedirects: 0 });
    expect(list.status()).toBe(307);
    expect(list.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(messages)}`);

    const first = `${messages}?to=talent&at=arif-hidayat`;
    const answer = await page.request.get(first, { maxRedirects: 0 });
    expect(answer.status()).toBe(307);
    expect(answer.headers()["location"]).toBe(`/sign-in?returnTo=${encodeURIComponent(first)}`);
  });

  test("the list says what was not read, and a conversation opens with its messages", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const written = await answerMessaging(page);
    await page.goto(messages);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Messages");
    await expect(page.getByRole("tab", { name: /Chats/ })).toContainText("2 unread messages");
    await expect(page.getByRole("tab", { name: /Requests/ })).toContainText(
      "1 first message waits",
    );
    await expect(rows(page, "Chats")).toHaveCount(2);
    const arif = rows(page, "Chats").filter({ hasText: "Arif Hidayat" });
    await expect(arif).toContainText("I can start in November.");
    await expect(arif).toContainText("2 unread messages");
    // A first message that waits for the other side says so in the list.
    await expect(rows(page, "Chats").filter({ hasText: "Staple AI" })).toContainText("Waiting");
    await expectNoSeriousA11yViolations(page);

    await arif.click();

    await expect(page).toHaveURL(new RegExp(`[?&]c=${arifChat}`));
    await expect(title(page, "Arif Hidayat")).toBeVisible();
    await expect(
      page.getByText("Could you review our OCR pipeline?", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Yes. Which documents do you read?", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Write to Arif Hidayat" })).toBeVisible();
    // Reading it tells the backend how far, and nothing waits in it any more.
    await expect
      .poll(() => written)
      .toContainEqual({
        call: `POST /api/messaging/conversations/${arifChat}/read`,
        body: { seq: 13 },
      });
    if (isMobile) {
      // On a phone the list and the conversation take turns.
      await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
      await page.getByRole("button", { name: "Back to conversations" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    } else {
      await expect(arif).toHaveAttribute("aria-current", "true");
      await expect(arif).not.toContainText("unread");
    }
    await expectNoSeriousA11yViolations(page);
  });

  test("Back and Forward keep the selected conversation in step with the address", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await answerMessaging(page);
    await page.goto(messages);
    await rows(page, "Chats").filter({ hasText: "Arif Hidayat" }).click();
    await expect(title(page, "Arif Hidayat")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(messages);
    await expect(title(page, "Arif Hidayat")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`[?&]c=${arifChat}`));
    await expect(title(page, "Arif Hidayat")).toBeVisible();
  });

  test("a message is shown at once and written under an identifier the screen chose", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const written = await answerMessaging(page);
    await page.goto(`${messages}?c=${arifChat}`);

    const composer = page.getByRole("textbox", { name: "Write to Arif Hidayat" });
    await composer.fill("November works. Shall we talk on Monday?");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(
      page.getByText("November works. Shall we talk on Monday?", { exact: true }),
    ).toBeVisible();
    await expect(composer).toHaveValue("");
    await expect(page.getByText("Not sent.")).toHaveCount(0);
    await expect
      .poll(() => written.filter((one) => one.call.endsWith("/messages")))
      .toEqual([
        {
          call: `POST /api/messaging/conversations/${arifChat}/messages`,
          body: {
            id: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/,
            ),
            body: "November works. Shall we talk on Monday?",
          },
        },
      ]);
    await expectNoSeriousA11yViolations(page);
  });

  test("a first message that waits is read under Requests and accepted", async ({
    page,
    context,
    baseURL,
    isMobile,
  }) => {
    await signInAs(context, "owner", baseURL!);
    const written = await answerMessaging(page);
    // The stub keeps nothing, so once the request is accepted the lists are answered here as the
    // backend would: the request is a conversation among the chats.
    await page.route("**/api/messaging/conversations", async (route) => {
      const accepted = written.some((one) => one.call.endsWith("/accept"));
      if (route.request().method() !== "GET" || !accepted) {
        return route.fallback();
      }
      const answer = await route.fetch({ url: `${stubOrigin}/api/messaging/conversations` });
      const list = (await answer.json()) as { chats: object[]; requests: object[] };
      await route.fulfill({
        json: {
          ...list,
          requests: [],
          chats: [
            { ...list.requests[0], status: "accepted", canWrite: true, canAnswer: false },
            ...list.chats,
          ],
        },
      });
    });
    await page.goto(messages);

    await page.getByRole("tab", { name: /Requests/ }).click();
    await expect(page).toHaveURL(/[?&]tab=requests/);
    const request = rows(page, "Requests").filter({ hasText: "Hà Lê" });
    await expect(request).toContainText("New");
    await request.click();

    await expect(title(page, "Hà Lê")).toBeVisible();
    await expect(
      page.getByText("We want a renewals assistant for our clinics.", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Hà Lê has not written to you before. They will not know you have read this until you accept.",
      ),
    ).toBeVisible();
    // Nothing is written in a request until it is accepted.
    await expect(page.getByRole("textbox", { name: "Write to Hà Lê" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Report as spam" })).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page.getByRole("button", { name: "Accept" }).click();

    await expect(page.getByText("Accepted. You can talk here now.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Write to Hà Lê" })).toBeVisible();
    if (isMobile) {
      await page.getByRole("button", { name: "Back to conversations" }).click();
    }
    await expect(page.getByRole("tab", { name: /Requests/ })).toHaveText("Requests");
    expect(written.filter((one) => one.call.endsWith("/accept"))).toEqual([
      { call: `POST /api/messaging/conversations/${haRequest}/accept`, body: null },
    ]);
  });

  test("Contact leads to a first message: who reads it is said, then the conversation opens", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "unnamed", baseURL!);
    const written = await answerMessaging(page);
    await page.goto(`${messages}?to=talent&at=arif-hidayat`);

    await expect(title(page, "Arif Hidayat")).toBeVisible();
    await expect(
      page.getByText(
        "Arif Hidayat reads your name and your organization, never your email address.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "You have not talked with Arif Hidayat before. Your first message waits under their Requests until they accept.",
      ),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await page
      .getByRole("textbox", { name: "Write your first message to Arif Hidayat" })
      .fill("Would you lead our OCR pilot?");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    // The conversation it started is open, and waits for the person to accept.
    await expect(page).toHaveURL(/[?&]c=c0a1b2c3-0009-/);
    await expect(page).not.toHaveURL(/[?&]to=/);
    await expect(page.getByText("Would you lead our OCR pilot?", { exact: true })).toBeVisible();
    await expect(page.getByText("You can write again when Arif Hidayat accepts.")).toBeVisible();
    expect(written.filter((one) => one.call.endsWith("/conversations"))).toEqual([
      {
        call: "POST /api/messaging/conversations",
        body: {
          id: expect.any(String),
          kind: "talent",
          slug: "arif-hidayat",
          body: "Would you lead our OCR pilot?",
        },
      },
    ]);
  });

  test("a person who may not write somewhere is told why, in the words of the code", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, "owner", baseURL!);
    await answerMessaging(page);
    await page.goto(`${messages}?to=solution&at=policy-chat`);

    await expect(page.getByRole("heading", { level: 2 })).toHaveText("You cannot write here");
    await expect(page.getByText("You cannot start a conversation with yourself.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /Write/ })).toHaveCount(0);
  });

  test("the account menu shows Messages with what waits", async ({ page, context, baseURL }) => {
    await signInAs(context, "owner", baseURL!);
    await page.goto("/");

    await page
      .getByRole("banner")
      .getByRole("button", { name: "Account menu for Minh Trần" })
      .click();
    const item = page.getByRole("menu").getByRole("menuitem", { name: /Messages/ });
    // Two unread messages and one first message to answer.
    await expect(item).toContainText("3 wait for you");
    await expect(item).toHaveAttribute("href", messages);
    await expectNoSeriousA11yViolations(page);

    // Someone for whom nothing waits reads no count.
    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/");
    await page
      .getByRole("banner")
      .getByRole("button", { name: /Account menu/ })
      .click();
    await expect(page.getByRole("menu").getByRole("menuitem", { name: "Messages" })).toHaveText(
      "Messages",
    );
  });
});

test.describe("contact on a solution and on a program", () => {
  test.use({ locale: "en-US" });

  test("a solution's Contact leads to Messages, after signing in for a visitor", async ({
    page,
    context,
    baseURL,
  }) => {
    const first = `${messages}?to=solution&at=policy-chat`;
    await page.goto("/solutions/policy-chat");

    const contact = page.getByRole("link", { name: "Contact", exact: true });
    await expect(contact).toHaveAttribute("href", `/sign-in?returnTo=${encodeURIComponent(first)}`);
    await expect(
      page.getByText(
        "Your first message waits until they accept, and your email address is never shown.",
      ),
    ).toBeVisible();
    await expectNoSeriousA11yViolations(page);

    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/solutions/policy-chat");
    await expect(contact).toHaveAttribute("href", first);

    // The people of the organization that offers it have nobody to write to but themselves.
    await signInAs(context, "member", baseURL!);
    await page.goto("/solutions/policy-chat");
    await expect(page.getByRole("link", { name: "Visit website" })).toBeVisible();
    await expect(contact).toHaveCount(0);
  });

  test("a program's page offers to ask GenAI Fund, and a draft does not", async ({
    page,
    context,
    baseURL,
  }) => {
    const first = `${messages}?to=program&at=genai-builders-hanoi`;
    await page.goto("/programs/genai-builders-hanoi");

    const ask = page.getByRole("link", { name: "Ask GenAI Fund" }).first();
    await expect(ask).toHaveAttribute("href", `/sign-in?returnTo=${encodeURIComponent(first)}`);
    await expectNoSeriousA11yViolations(page);

    await signInAs(context, "unnamed", baseURL!);
    await page.goto("/programs/genai-builders-hanoi");
    await expect(ask).toHaveAttribute("href", first);
    // A page written for one program offers it in its card to apply.
    await page.goto("/programs/insurance-ai-tasco");
    await expect(page.getByRole("link", { name: "Ask GenAI Fund" }).first()).toHaveAttribute(
      "href",
      `${messages}?to=program&at=insurance-ai-tasco`,
    );

    // An operator is the one who answers, and a draft is not written about.
    await signInAs(context, "operator", baseURL!);
    await page.goto("/programs/genai-builders-hanoi");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GenAI Builders Hanoi");
    await expect(page.getByRole("link", { name: "Ask GenAI Fund" })).toHaveCount(0);
    await page.goto("/programs/genai-monthly-meetup");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("GenAI Monthly Meetup");
    await expect(page.getByRole("link", { name: "Ask GenAI Fund" })).toHaveCount(0);
  });
});
