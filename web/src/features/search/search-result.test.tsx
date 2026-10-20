import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SearchItem } from "@/lib/api/generated";
import { render } from "@/test/render";

import { SearchResult } from "./search-result";

/** A solution as the search answers it, with only what its row reads. */
function solution(fields: Partial<SearchItem>) {
  return {
    kind: "solution",
    slug: "claims-desk",
    title: "Claims Desk",
    subtitle: "Nhanh",
    snippet: "",
    focusAreas: ["conversational_ai"],
    industries: [],
    roles: [],
    customerDeployments: null,
    ...fields,
  } as SearchItem;
}

describe("SearchResult, a solution", () => {
  it("names the organization behind it", () => {
    render(<SearchResult item={solution({})} />);

    expect(screen.getByRole("link", { name: "Claims Desk" })).toHaveAttribute(
      "href",
      "/solutions/claims-desk",
    );
    expect(screen.getByText("By Nhanh")).toBeInTheDocument();
  });

  it.each(["Claims Desk", " claims desk "])(
    "leaves the organization out when it is named %j, as the solution is",
    (subtitle) => {
      render(<SearchResult item={solution({ subtitle })} />);

      expect(screen.queryByText(/^By /)).not.toBeInTheDocument();
    },
  );

  it.each([null, 0])("says nothing of customer cases when it has %j", (customerDeployments) => {
    render(<SearchResult item={solution({ customerDeployments })} />);

    expect(screen.getByText("Conversational AI")).toBeInTheDocument();
    expect(screen.queryByText(/customer case/)).not.toBeInTheDocument();
  });

  it("counts its customer cases after its capabilities", () => {
    render(<SearchResult item={solution({ customerDeployments: 2 })} />);

    expect(screen.getByText("Conversational AI · 2 customer cases")).toBeInTheDocument();
  });
});

/** A use case as the search answers it, with only what its row reads. */
function useCase(fields: Partial<SearchItem>) {
  return {
    kind: "use_case",
    slug: "4d5ee21e-8cc4-418c-93f4-236a4453d8de",
    title: "Claims triage",
    subtitle: "Tasco Insurance",
    snippet: "",
    focusAreas: [],
    industries: [],
    roles: [],
    budgetToBeDetermined: true,
    ...fields,
  } as SearchItem;
}

describe("SearchResult, a use case", () => {
  it("says when proposals close while it is open", () => {
    render(<SearchResult item={useCase({ closesAt: "2999-10-22T16:59:00Z" })} />);

    expect(screen.getByText("To be determined · Apply by 22 Oct 2999")).toBeInTheDocument();
  });

  it("says it closed, not to apply by a day gone, once it is closed", () => {
    render(<SearchResult item={useCase({ closesAt: "2026-10-01T16:59:00Z" })} />);

    expect(screen.getByText("To be determined · Closed on 1 Oct 2026")).toBeInTheDocument();
  });
});
