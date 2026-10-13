import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import { saveApplication, type ApplicationView, type Me } from "@/lib/api/generated";
import { render } from "@/test/render";

import { ApplyFlow } from "./apply-flow";

vi.mock("@/lib/api/generated", async (original) => ({
  ...(await original<typeof import("@/lib/api/generated")>()),
  saveApplication: vi.fn(),
}));

const text = "7c1e0a2b-0000-4000-8000-000000000002";
const confirm = "7c1e0a2b-0000-4000-8000-000000000004";

const account = { country: "VN", phone: null } as unknown as Me;

/** A draft of someone who applies on their own: step 1 is filled in, the rest as the test names. */
function draft(
  held: {
    deck?: boolean;
    answers?: Record<string, string>;
  } = {},
): ApplicationView {
  return {
    email: "an.tran@example.com",
    previous: null,
    organization: {
      id: "o1",
      name: "An Tran",
      type: "independent_builder",
      country: "VN",
      teamSize: "just_me",
      approved: false,
    },
    solutions: [
      {
        id: "s1",
        name: "Claim Copilot",
        summary: "A chat assistant that tells a driver what is covered.",
        problemsSolved: "Drivers wait on a hotline after a minor accident.",
        maturity: "pilot",
        demoUrl: null,
        complete: true,
      },
    ],
    program: {
      id: "p1",
      slug: "insurance-ai-tasco",
      name: "AI for Insurance Challenge × Tasco",
      opensAt: "2026-10-01T02:00:00Z",
      closesAt: "2026-10-23T16:59:00Z",
      outcomesDueOn: null,
      allowUpdatesUntilClose: true,
      open: true,
      questions: [
        {
          id: text,
          kind: "long_text",
          label: "How does your solution address the challenge?",
          help: null,
          required: true,
          options: [],
          maxLength: 600,
        },
        {
          id: confirm,
          kind: "confirm",
          label: "I have read the one hard constraint.",
          help: null,
          required: true,
          options: [],
          maxLength: 2000,
        },
      ],
    },
    application: {
      id: "a1",
      status: "draft",
      contact: {
        firstName: "An",
        lastName: "Tran",
        phone: "+84 912 345 678",
        country: "VN",
        linkedin: null,
      },
      teamBackground: null,
      solutionId: "s1",
      deck: held.deck
        ? { fileId: "f1", fileName: "claim-copilot-deck.pdf", sizeBytes: 2_400_000 }
        : null,
      builtWith: [],
      traction: null,
      answers: held.answers ?? {},
      files: {},
      submissions: 0,
      submittedAt: null,
      withdrawnAt: null,
      version: 2,
      updatedAt: "2026-10-10T03:00:00Z",
    },
  } as ApplicationView;
}

const complete = draft({
  deck: true,
  answers: { [text]: "Claims reach a decision without a hotline call.", [confirm]: "true" },
});

const heading = () => screen.getByRole("heading", { level: 1 });
// jsdom draws the list of a wide screen and the bar's own list; the first is the one always shown.
const steps = () =>
  within(screen.getAllByRole("list")[0])
    .getAllByRole("listitem")
    .map((step) => step.textContent);

describe("ApplyFlow", () => {
  it("takes a draft up at the first step that still lacks something", () => {
    render(<ApplyFlow initial={draft()} account={account} />);

    expect(heading()).toHaveTextContent("Your solution");
    // The step before it holds what it needs, and says so; nothing ahead is marked.
    expect(steps()).toEqual([
      "You and your teamComplete",
      "2Your solution",
      "3Questions from this program",
      "4Review and submit",
    ]);
  });

  it("takes a draft that lacks nothing up at the review, ready to submit", () => {
    render(<ApplyFlow initial={complete} account={account} />);

    expect(heading()).toHaveTextContent("Review and submit");
    expect(screen.getByRole("button", { name: "Submit application" })).toBeEnabled();
    expect(screen.queryByText("Missing")).not.toBeInTheDocument();
  });

  it("opens the step the address names, whatever the steps before it hold", () => {
    render(<ApplyFlow initial={draft()} account={account} />, { searchParams: "?step=1" });

    expect(heading()).toHaveTextContent("You and your team");
  });

  it("starts someone who has not applied yet at step 1", () => {
    render(<ApplyFlow initial={{ ...complete, application: null }} account={account} />);

    expect(heading()).toHaveTextContent("You and your team");
  });

  it("marks a step that was passed with something missing, instead of ticking it", () => {
    render(<ApplyFlow initial={draft({ deck: true })} account={account} />, {
      searchParams: "?step=4",
    });

    expect(steps()).toEqual([
      "You and your teamComplete",
      "Your solutionComplete",
      "3Questions from this program2 answers missing",
      "4Review and submit",
    ]);
  });

  it("holds Submit on the review while a step lacks something, and says why", () => {
    render(<ApplyFlow initial={draft()} account={account} />, { searchParams: "?step=4" });

    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
    expect(
      screen.getByText(
        "Something required is still missing. Fill in the lines marked Missing to submit.",
      ),
    ).toBeVisible();
    // The deck and the two answers; what is optional is only "Not added".
    expect(screen.getAllByText("Missing")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Fill in Solution deck" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Fill in Milestones and traction" }),
    ).not.toBeInTheDocument();
  });

  it("leads from a missing line of the review to its step and its field", async () => {
    const { user, onUrlUpdate } = render(<ApplyFlow initial={draft()} account={account} />, {
      searchParams: "?step=4",
    });

    await user.click(screen.getByRole("button", { name: "Fill in Solution deck" }));

    await waitFor(() => expect(heading()).toHaveTextContent("Your solution"));
    expect(onUrlUpdate.mock.lastCall?.[0].queryString).toBe("?step=2");
    // The deck's input is hidden: the button that opens it takes the focus.
    await waitFor(() => expect(screen.getByRole("button", { name: /Choose a PDF/ })).toHaveFocus());
  });

  it("leads to a question that is answered with a tick", async () => {
    const { user } = render(<ApplyFlow initial={draft({ deck: true })} account={account} />, {
      searchParams: "?step=4",
    });

    await user.click(
      screen.getByRole("button", { name: "Fill in I have read the one hard constraint." }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("checkbox", { name: "I have read the one hard constraint." }),
      ).toHaveFocus(),
    );
  });

  it("opens the step of a field the backend refuses and marks the field", async () => {
    // Every save sends the whole application: the field refused is not on the step shown.
    vi.mocked(saveApplication).mockRejectedValueOnce(
      new ApiError(400, {
        title: "Bad Request",
        status: 400,
        code: "REQUEST_INVALID",
        requestId: "r1",
        errors: [{ pointer: "#/traction", code: "SIZE", detail: "size must be between 0 and 600" }],
      }),
    );
    const { user } = render(<ApplyFlow initial={complete} account={account} />);

    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(heading()).toHaveTextContent("Your solution"));
    const traction = screen.getByRole("textbox", { name: /Milestones and traction/ });
    await waitFor(() => expect(traction).toBeInvalid());
    expect(traction).toHaveAccessibleDescription(/This was not accepted/);
    expect(traction).toHaveFocus();
    expect(screen.getByText(/A field was not accepted/)).toBeInTheDocument();

    // The mark is the form's own: it stays until the person changes the field.
    await user.type(traction, "Two pilots.");
    await waitFor(() => expect(traction).toBeValid());
  });

  it("says a refusal of the list of tools at the list, which has no rule of its own", async () => {
    vi.mocked(saveApplication).mockRejectedValueOnce(
      new ApiError(400, {
        title: "Bad Request",
        status: 400,
        code: "REQUEST_INVALID",
        requestId: "r1",
        errors: [
          { pointer: "#/builtWith/3", code: "SIZE", detail: "size must be between 0 and 60" },
        ],
      }),
    );
    const { user } = render(<ApplyFlow initial={complete} account={account} />);

    await user.click(screen.getByRole("checkbox", { name: /I confirm/ }));
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(heading()).toHaveTextContent("Your solution"));
    const tools = screen.getByRole("textbox", { name: /Built with/ });
    await waitFor(() => expect(tools).toBeInvalid());
    expect(tools).toHaveAccessibleDescription(/This was not accepted/);
    expect(tools).toHaveFocus();
  });
});
