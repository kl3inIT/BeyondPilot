import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SolutionPerkLine } from "@/lib/api/generated";
import { render } from "@/test/render";

import { PerkPanel } from "./solution-perks";

const perk = (title: string, fromGenAiFund = false): SolutionPerkLine => ({
  slug: title.toLowerCase().replaceAll(" ", "-"),
  title,
  value: null,
  fromGenAiFund,
});

describe("PerkPanel", () => {
  it("groups the perks by who arranged them, GenAI Fund's first, each leading to its page", () => {
    render(
      <PerkPanel
        organization="Acme AI"
        perks={[perk("Discount"), perk("Cloud credits", true), perk("Free pilot")]}
      />,
    );

    const groups = screen.getAllByRole("heading", { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual([
      "Arranged by GenAI Fund1",
      "From Acme AI2",
    ]);
    expect(screen.getByRole("link", { name: /Cloud credits/ })).toHaveAttribute(
      "href",
      "/solutions/perks/cloud-credits",
    );
  });

  it("names no group that has no perk", () => {
    render(<PerkPanel organization="Acme AI" perks={[perk("Discount")]} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.queryByText(/Arranged by GenAI Fund/)).not.toBeInTheDocument();
  });

  it("lists every perk of a group, however many there are", () => {
    const own = ["One", "Two", "Three", "Four", "Five"].map((title) => perk(title));
    render(<PerkPanel organization="Acme AI" perks={own} />);

    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("link")).toHaveLength(5);
  });

  it("opens with the perks in view, and folds them all from its heading", async () => {
    const { user } = render(
      <PerkPanel organization="Acme AI" perks={[perk("Discount"), perk("Free pilot", true)]} />,
    );

    const heading = screen.getByRole("button", { name: "Perks" });
    expect(heading).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("link")).toHaveLength(2);

    await user.click(heading);

    expect(heading).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("shows nothing when the solution goes with no perk", () => {
    const { container } = render(<PerkPanel organization="Acme AI" perks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
