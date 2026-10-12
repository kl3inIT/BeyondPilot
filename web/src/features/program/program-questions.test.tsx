import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProgramQuestions } from "@/lib/api/generated";
import { render } from "@/test/render";

import { ProgramQuestionsEditor } from "./program-questions";

const question = (id: string, label: string) => ({
  id,
  kind: "long_text" as const,
  label,
  help: null,
  required: true,
  options: [],
  maxLength: null,
});

const stored: ProgramQuestions = {
  fixed: false,
  opensAt: null,
  version: 3,
  questions: [question("q1", "Direction"), question("q2", "Approach"), question("q3", "Team")],
};

const labels = () =>
  within(screen.getByRole("list"))
    .getAllByRole("listitem")
    .map((row) => row.textContent);

describe("ProgramQuestionsEditor", () => {
  it("keeps the focus on the question that was moved, so moving it again moves it on", async () => {
    const { user } = render(<ProgramQuestionsEditor programId="p1" initial={stored} />);

    await user.click(screen.getByRole("button", { name: "Move Direction down" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Direction down" })).toHaveFocus(),
    );
    expect(labels()).toEqual([
      expect.stringContaining("Approach"),
      expect.stringContaining("Direction"),
      expect.stringContaining("Team"),
    ]);

    // The same key again takes the same question further, not the one that took its place.
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(labels()).toEqual([
        expect.stringContaining("Approach"),
        expect.stringContaining("Team"),
        expect.stringContaining("Direction"),
      ]),
    );
  });

  it("hands the focus to the other way once the question reaches an end of the list", async () => {
    const { user } = render(<ProgramQuestionsEditor programId="p1" initial={stored} />);

    await user.click(screen.getByRole("button", { name: "Move Approach up" }));

    // First now: it cannot go further up, and its button for that is switched off.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Approach down" })).toHaveFocus(),
    );
    expect(screen.getByRole("button", { name: "Move Approach up" })).toBeDisabled();
  });

  it("says where a moved question now stands", async () => {
    const { user } = render(<ProgramQuestionsEditor programId="p1" initial={stored} />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    await user.click(screen.getByRole("button", { name: "Move Team up" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Team moved to position 2 of 3."),
    );
  });

  it("says a change is not saved, and holds Save until there is one", async () => {
    const { user } = render(<ProgramQuestionsEditor programId="p1" initial={stored} />);

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Team up" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    expect(screen.getByText("You have unsaved changes.")).toBeVisible();
  });

  it("offers no way to change questions that are fixed, and announces nothing", () => {
    render(
      <ProgramQuestionsEditor
        programId="p1"
        initial={{ ...stored, fixed: true, opensAt: "2026-10-01T02:00:00Z" }}
      />,
    );

    expect(screen.queryByRole("button", { name: /^Move / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    // The one status is the line that says the questions are fixed.
    expect(screen.getByRole("status")).toHaveTextContent("the questions can no longer change");
  });

  it("marks the choices of a question that has too few, with the reason, and puts the focus there", async () => {
    const choice = { ...question("q4", "Direction"), kind: "single_choice" as const };
    const { user } = render(
      <ProgramQuestionsEditor
        programId="p1"
        initial={{ ...stored, questions: [{ ...choice, options: ["Buying"] }] }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Direction" }));
    const dialog = await screen.findByRole("dialog");
    const choices = within(dialog).getByRole("textbox", { name: "Choices" });
    expect(choices).toBeValid();

    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(choices).toBeInvalid());
    expect(choices).toHaveAccessibleDescription(
      expect.stringContaining("Add at least two choices."),
    );
    await waitFor(() => expect(choices).toHaveFocus());

    // A second choice clears it.
    await user.type(choices, "Claiming{Enter}");
    await waitFor(() => expect(choices).toBeValid());
    expect(within(dialog).queryByText("Add at least two choices.")).not.toBeInTheDocument();
  });
});
