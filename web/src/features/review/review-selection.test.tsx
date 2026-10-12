import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render";

import { PageLeadingAction, ReviewSelection } from "./review-selection";
import { ReviewTable, type ReviewRow } from "./review-table";

const row = (id: string, solution: string): ReviewRow => ({
  id,
  href: `/admin/programs/p1/applications/${id}`,
  solution,
  applicant: "Plain Cover Pte · Startup",
  choice: null,
  submitted: "3 Oct, 10:00",
  scores: "Not scored yet",
  status: { label: "Under review", variant: "warning" },
  own: false,
});

function page() {
  return (
    <ReviewSelection>
      <PageLeadingAction href="/admin/programs/p1/release">Release outcomes</PageLeadingAction>
      <ReviewTable
        programId="p1"
        rows={[row("a1", "Plain Cover"), row("a2", "Claims Desk")]}
        matching={["a1", "a2"]}
        sortKeys={[]}
        defaultSort=""
        choiceLabel={null}
        operator
        released={false}
      />
    </ReviewSelection>
  );
}

const release = () => screen.getByRole("link", { name: "Release outcomes" });

describe("a program's applications", () => {
  it("has one primary action: the page's own, until rows are selected, then the selection bar's", async () => {
    const { user } = render(page());
    expect(release()).toHaveAttribute("data-prominence", "primary");

    await user.click(screen.getByRole("checkbox", { name: "Select Plain Cover" }));

    await waitFor(() => expect(release()).toHaveAttribute("data-prominence", "secondary"));
    expect(screen.getByRole("button", { name: "Shortlist" })).toHaveAttribute(
      "data-prominence",
      "primary",
    );
    expect(screen.getByRole("button", { name: "Not selected" })).toHaveAttribute(
      "data-prominence",
      "secondary",
    );

    await user.click(screen.getByRole("button", { name: "Clear selection" }));

    await waitFor(() => expect(release()).toHaveAttribute("data-prominence", "primary"));
  });
});
