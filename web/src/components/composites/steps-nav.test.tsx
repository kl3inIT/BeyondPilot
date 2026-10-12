import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { render } from "@/test/render";

import { StepsNav } from "./steps-nav";

const steps = [
  { id: "challenge", title: "The challenge", done: true },
  { id: "outcomes", title: "Outcomes and users", done: false },
  { id: "requirements", title: "Requirements", done: false, problem: "Add a requirement." },
  { id: "budget", title: "Budget", done: false },
  { id: "review", title: "Review", done: false },
] as const;

type Step = (typeof steps)[number]["id"];

function nav(props: { current?: Step; onStep?: (step: Step) => void } = {}) {
  return (
    <StepsNav
      label="Steps of the use case"
      heading="Your use case"
      steps={steps}
      current={props.current ?? "outcomes"}
      onStep={props.onStep}
      doneLabel="Done"
    />
  );
}

// jsdom applies no stylesheet, so the bar of a narrow screen and the list of a wide one are both
// in the document: the list that is always shown, and the bar's own list, hidden until it opens.
const bar = () => screen.getByRole("button", { name: /^Step \d of \d/ });
const lists = () => screen.getAllByRole("list");

describe("StepsNav", () => {
  it("marks the step the person is on, and no other", () => {
    render(nav({ onStep: () => {} }));

    const list = within(lists()[0]);
    expect(list.getByRole("button", { current: "step" })).toHaveTextContent("Outcomes and users");
    expect(list.getAllByRole("button", { current: false })).toHaveLength(4);
  });

  it("marks the step the person is on where the steps are only shown", () => {
    render(nav());

    expect(within(lists()[0]).getByRole("generic", { current: "step" })).toHaveTextContent(
      "Outcomes and users",
    );
  });

  it("says on the bar which step this is, of how many, and its name", () => {
    render(nav({ current: "budget" }));

    expect(bar()).toHaveTextContent("Step 4 of 5 · Budget");
  });

  it("opens and closes the list of steps from the bar", async () => {
    const { user } = render(nav());
    expect(bar()).toHaveAttribute("aria-expanded", "false");
    expect(lists()).toHaveLength(1);

    await user.click(bar());
    expect(bar()).toHaveAttribute("aria-expanded", "true");
    expect(lists()).toHaveLength(2);

    await user.click(bar());
    expect(bar()).toHaveAttribute("aria-expanded", "false");
  });

  it("draws the steps as buttons that open them when it is told how", async () => {
    const onStep = vi.fn();
    const { user } = render(nav({ onStep }));

    await user.click(screen.getByRole("button", { name: "Budget" }));

    expect(onStep).toHaveBeenCalledExactlyOnceWith("budget");
  });

  it("closes the bar's list once a step is picked from it", async () => {
    const onStep = vi.fn();
    const { user } = render(nav({ onStep }));
    await user.click(bar());

    await user.click(within(lists()[0]).getByRole("button", { name: "Review" }));

    expect(onStep).toHaveBeenCalledExactlyOnceWith("review");
    expect(bar()).toHaveAttribute("aria-expanded", "false");
  });

  it("only shows the steps when nothing opens them", () => {
    render(nav());

    expect(screen.getAllByRole("button")).toEqual([bar()]);
    expect(within(lists()[0]).getAllByRole("listitem")).toHaveLength(5);
  });

  it("says under a step what it still lacks", () => {
    render(nav({ onStep: () => {} }));

    const [, , requirements, budget] = within(lists()[0]).getAllByRole("listitem");
    expect(within(requirements).getByText("Add a requirement.")).toBeInTheDocument();
    // Beside the step's button, not in it: the name of the step stays its name.
    expect(within(requirements).getByRole("button")).toHaveAccessibleName("Requirements");
    expect(within(budget).getByRole("button")).toHaveAccessibleName("Budget");
    expect(screen.getAllByText("Add a requirement.")).toHaveLength(2);
  });

  it("says a step is done to those who do not see its check", () => {
    render(nav({ onStep: () => {} }));

    expect(screen.getByRole("button", { name: /^The challenges*Done$/ })).toBeInTheDocument();
  });
});
