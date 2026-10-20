import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PublicOffer } from "@/lib/api/generated";
import { render } from "@/test/render";

import { OfferPanel } from "./solution-offers";

const offer = (title: string, fromGenAiFund = false): PublicOffer => ({
  title,
  url: `https://example.com/${title.replaceAll(" ", "-")}`,
  fromGenAiFund,
});

describe("OfferPanel", () => {
  it("groups the offers by who arranged them, GenAI Fund's first", () => {
    render(
      <OfferPanel
        organization="Acme AI"
        offers={[offer("200$"), offer("1000$ cloud credits", true), offer("Free pilot")]}
      />,
    );

    const groups = screen.getAllByRole("heading", { level: 3 });
    expect(groups.map((group) => group.textContent)).toEqual([
      "Arranged by GenAI Fund1",
      "From Acme AI2",
    ]);
    expect(screen.getByRole("link", { name: /1000\$ cloud credits/ })).toHaveAttribute(
      "href",
      "https://example.com/1000$-cloud-credits",
    );
  });

  it("names no group that has no offer", () => {
    render(<OfferPanel organization="Acme AI" offers={[offer("200$")]} />);

    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1);
    expect(screen.queryByText(/Arranged by GenAI Fund/)).not.toBeInTheDocument();
  });

  it("folds the offers of a group past the third until they are asked for", async () => {
    const own = ["One", "Two", "Three", "Four", "Five"].map((title) => offer(title));
    const { user } = render(<OfferPanel organization="Acme AI" offers={own} />);

    expect(screen.getAllByRole("link")).toHaveLength(3);
    const more = screen.getByRole("button", { name: /Show 2 more/ });
    expect(more).toHaveAttribute("aria-expanded", "false");

    await user.click(more);

    const list = screen.getAllByRole("list");
    expect(within(list[1]).getByRole("link", { name: /Five/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(5);
    expect(screen.getByRole("button", { name: /Show fewer/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows nothing when the solution comes with no offer", () => {
    const { container } = render(<OfferPanel organization="Acme AI" offers={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
