import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { render } from "@/test/render";

import { ReviewStatus, reviewState, type ReviewState } from "./review-status";

describe("ReviewStatus", () => {
  it.each<[ReviewState, string]>([
    ["draft", "neutral"],
    ["in_review", "warning"],
    ["needs_changes", "warning"],
    ["approved", "success"],
    ["rejected", "destructive"],
    ["suspended", "destructive"],
    ["closed", "neutral"],
    ["merged", "neutral"],
  ])("shows %s in the %s tone", (state, tone) => {
    render(<ReviewStatus state={state}>The word</ReviewStatus>);

    expect(screen.getByText("The word")).toHaveAttribute("data-tone", tone);
  });

  it("keeps the tone when the state is drawn as a pill", () => {
    render(
      <ReviewStatus state="approved" appearance="pill">
        Approved
      </ReviewStatus>,
    );

    expect(screen.getByText("Approved")).toHaveAttribute("data-tone", "success");
  });
});

describe("reviewState", () => {
  it("reads an approved record that was taken down as suspended", () => {
    expect(reviewState({ status: "approved", suspendedAt: "2026-10-01T00:00:00Z" })).toBe(
      "suspended",
    );
  });

  it("reads a record taken down and sent again as the review it waits for", () => {
    expect(reviewState({ status: "in_review", suspendedAt: "2026-10-01T00:00:00Z" })).toBe(
      "in_review",
    );
  });

  it("reads any other record as its status", () => {
    expect(reviewState({ status: "approved", suspendedAt: null })).toBe("approved");
    expect(reviewState({ status: "draft" })).toBe("draft");
  });
});
