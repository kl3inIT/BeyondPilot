import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewCriterion } from "@/lib/api/generated";
import { render } from "@/test/render";

import { AssessmentPanel } from "./assessment-panel";

const criteria: ReviewCriterion[] = [
  { id: "c1", name: "Problem fit", description: "How well it answers the challenge." },
  { id: "c2", name: "Feasibility", description: null },
  { id: "c3", name: "Team" },
];

function panel(props: { released?: boolean; judge?: boolean; nextHref?: string } = {}) {
  return (
    <AssessmentPanel
      applicationId="a1"
      criteria={criteria}
      mine={null}
      version={1}
      judge={props.judge ?? true}
      released={props.released ?? false}
      nextHref={props.nextHref ?? null}
    />
  );
}

const scale = (name: string) => screen.getByRole("radiogroup", { name });
// The panel's own Save; the bar of a narrow screen, which jsdom also draws, has no Save until
// every criterion is scored.
const save = () => screen.getAllByRole("button", { name: "Save" })[0];

describe("AssessmentPanel", () => {
  it("offers each criterion as one choice of ten, named by the criterion and described by what a judge looks for", () => {
    render(panel());

    const fit = scale("Problem fit");
    expect(within(fit).getAllByRole("radio")).toHaveLength(10);
    expect(fit).toHaveAccessibleDescription("How well it answers the challenge.");
    expect(within(fit).getByRole("radio", { name: "7 out of 10, Strong" })).not.toBeChecked();
    expect(scale("Feasibility")).not.toHaveAccessibleDescription();
    // What the numbers mean is in sight above the scale.
    expect(
      screen.getByText("1–3 Weak · 4–6 Average · 7–8 Strong · 9–10 Outstanding"),
    ).toBeVisible();
  });

  it("chooses one score a criterion, says what it means, and moves along the scale with the arrow keys", async () => {
    const { user } = render(panel());
    const fit = within(scale("Problem fit"));

    await user.click(fit.getByRole("radio", { name: "6 out of 10, Average" }));
    await waitFor(() =>
      expect(fit.getByRole("radio", { name: "6 out of 10, Average" })).toBeChecked(),
    );
    expect(screen.getByText("Average")).toBeVisible();

    await user.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(fit.getByRole("radio", { name: "7 out of 10, Strong" })).toBeChecked(),
    );
    expect(fit.getByRole("radio", { name: "7 out of 10, Strong" })).toHaveFocus();
    expect(fit.getAllByRole("radio", { checked: true })).toHaveLength(1);
  });

  it("says how many criteria are scored, and why the save is held until all are", async () => {
    const { user } = render(panel());

    // Once in the panel and once in the bar of a narrow screen.
    expect(screen.getAllByText("0 of 3 criteria scored")).toHaveLength(2);
    expect(save()).toBeDisabled();
    expect(save()).toHaveAccessibleDescription(
      "3 criteria still need a score before you can save.",
    );

    await user.click(
      within(scale("Problem fit")).getByRole("radio", { name: "8 out of 10, Strong" }),
    );
    await user.click(
      within(scale("Feasibility")).getByRole("radio", { name: "6 out of 10, Average" }),
    );
    await waitFor(() => expect(screen.getAllByText("2 of 3 criteria scored")).toHaveLength(2));
    expect(screen.getByText("1 criterion still needs a score before you can save.")).toBeVisible();
    expect(screen.queryByText(/^Average \d/)).not.toBeInTheDocument();

    await user.click(
      within(scale("Team")).getByRole("radio", { name: "10 out of 10, Outstanding" }),
    );
    await waitFor(() => expect(save()).toBeEnabled());
    expect(screen.getByText("Average 8.0")).toBeVisible();
    expect(screen.queryByText(/still need/)).not.toBeInTheDocument();
    expect(save()).not.toHaveAccessibleDescription();
  });

  it("keeps a note and a bookmark without a score, and never shows the weights", async () => {
    const { user } = render(
      <AssessmentPanel
        applicationId="a1"
        criteria={[{ id: "p1", name: "Practical impact", description: null, maxPoints: 20 }]}
        mine={null}
        version={1}
        judge
        released={false}
        nextHref={null}
      />,
    );

    const note = screen.getByRole("button", { name: "Save note" });
    expect(note).toBeDisabled();
    await user.type(screen.getByLabelText("Private note"), "Strong live demo.");
    await waitFor(() => expect(note).toBeEnabled());
    expect(screen.getByRole("button", { name: "Bookmark" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByText(/20/)).not.toBeInTheDocument();
  });

  it("draws a judge's Save and next as the primary action, beside Skip", () => {
    render(panel({ nextHref: "/reviews/p1/a2" }));

    expect(screen.getAllByRole("button", { name: "Save and next" })[0]).toHaveAttribute(
      "data-prominence",
      "primary",
    );
    expect(screen.getByRole("link", { name: "Skip" })).toHaveAttribute(
      "data-prominence",
      "tertiary",
    );
  });

  it("draws a plain Save, and an operator's save under the decision, as secondary", () => {
    const { unmount } = render(panel());
    expect(save()).toHaveAttribute("data-prominence", "secondary");
    unmount();

    render(panel({ judge: false, nextHref: "/admin/programs/p1/applications/a2" }));
    expect(screen.getAllByRole("button", { name: "Save and next" })[0]).toHaveAttribute(
      "data-prominence",
      "secondary",
    );
  });

  it("takes no score once the outcomes are released", () => {
    render(panel({ released: true }));

    for (const radio of within(scale("Problem fit")).getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
