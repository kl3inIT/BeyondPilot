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

function panel(props: { released?: boolean } = {}) {
  return (
    <AssessmentPanel
      applicationId="a1"
      criteria={criteria}
      mine={null}
      version={1}
      judge
      released={props.released ?? false}
      nextHref={null}
    />
  );
}

const scale = (name: string) => screen.getByRole("radiogroup", { name });
// The panel's own Save; the bar of a narrow screen, which jsdom also draws, has no Save until
// every criterion is scored.
const save = () => screen.getAllByRole("button", { name: "Save" })[0];

describe("AssessmentPanel", () => {
  it("offers each criterion as one choice of five, named by the criterion and described by what a judge looks for", () => {
    render(panel());

    const fit = scale("Problem fit");
    expect(within(fit).getAllByRole("radio")).toHaveLength(5);
    expect(fit).toHaveAccessibleDescription("How well it answers the challenge.");
    expect(within(fit).getByRole("radio", { name: "4 out of 5" })).not.toBeChecked();
    expect(scale("Feasibility")).not.toHaveAccessibleDescription();
  });

  it("chooses one score a criterion, and moves along the scale with the arrow keys", async () => {
    const { user } = render(panel());
    const fit = within(scale("Problem fit"));

    await user.click(fit.getByRole("radio", { name: "2 out of 5" }));
    await waitFor(() => expect(fit.getByRole("radio", { name: "2 out of 5" })).toBeChecked());

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(fit.getByRole("radio", { name: "3 out of 5" })).toBeChecked());
    expect(fit.getByRole("radio", { name: "3 out of 5" })).toHaveFocus();
    expect(fit.getByRole("radio", { name: "2 out of 5" })).not.toBeChecked();
    expect(fit.getAllByRole("radio", { checked: true })).toHaveLength(1);
  });

  it("says how many criteria are scored, and why the save is held until all are", async () => {
    const { user } = render(panel());

    // Once in the panel and once in the bar of a narrow screen.
    expect(screen.getAllByText("Scored 0 of 3")).toHaveLength(2);
    expect(save()).toBeDisabled();
    expect(save()).toHaveAccessibleDescription(
      "3 criteria still need a score before you can save.",
    );

    await user.click(within(scale("Problem fit")).getByRole("radio", { name: "4 out of 5" }));
    await user.click(within(scale("Feasibility")).getByRole("radio", { name: "3 out of 5" }));
    await waitFor(() => expect(screen.getAllByText("Scored 2 of 3")).toHaveLength(2));
    expect(screen.getByText("1 criterion still needs a score before you can save.")).toBeVisible();
    expect(screen.queryByText(/^Average/)).not.toBeInTheDocument();

    await user.click(within(scale("Team")).getByRole("radio", { name: "5 out of 5" }));
    await waitFor(() => expect(save()).toBeEnabled());
    expect(screen.getByText("Average 4.0")).toBeVisible();
    expect(screen.queryByText(/still need/)).not.toBeInTheDocument();
    expect(save()).not.toHaveAccessibleDescription();
  });

  it("takes no score once the outcomes are released", () => {
    render(panel({ released: true }));

    for (const radio of within(scale("Problem fit")).getAllByRole("radio")) {
      expect(radio).toHaveAttribute("aria-disabled", "true");
    }
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
