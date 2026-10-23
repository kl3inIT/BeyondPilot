import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyOrganization, Organization } from "@/lib/api/generated";
import { render } from "@/test/render";

import { OrganizationFrame } from "./organization-frame";

const complete = {
  id: "o1",
  slug: "pocket-policy",
  name: "Pocket Policy",
  type: "company",
  status: "active",
  country: "SG",
  teamSize: "10_49",
  industries: ["insurance"],
  website: "https://pocketpolicy.example",
  description: "Assistants for insurers across Southeast Asia.",
  foundedYear: 2021,
  logoFileId: null,
  emailDomain: null,
  version: 1,
} as unknown as Organization;

const counts = { members: 1, solutions: null, useCases: null };

function frame(organization: Organization, current: "profile" | "members", role = "owner") {
  const mine = { role, organization } as MyOrganization & { organization: Organization };
  return (
    <OrganizationFrame mine={mine} current={current} counts={counts}>
      <p>Page</p>
    </OrganizationFrame>
  );
}

describe("OrganizationFrame, for a person on their own", () => {
  it("is an ordinary organization: its type is named and it has the profile, members and perks tabs", () => {
    render(frame({ ...complete, type: "independent_builder" }, "members"));

    expect(screen.getByText("Just me")).toBeVisible();
    expect(screen.getByRole("link", { name: /Profile/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Members/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Perks/ })).toBeVisible();
  });
});

describe("OrganizationFrame, for a new organization", () => {
  it("shows no review banner and asks for nothing more, however little the profile holds", () => {
    render(frame({ ...complete, website: null, foundedYear: null, description: "" }, "members"));

    expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Complete profile" })).not.toBeInTheDocument();
    expect(screen.queryByText(/required field/)).not.toBeInTheDocument();
  });
});

describe("OrganizationFrame, once the organization is taken down", () => {
  it("shows the taken-down banner with the reason its owners read", () => {
    render(
      frame(
        {
          ...complete,
          suspendedAt: "2026-10-01T00:00:00Z",
          suspensionReason: "breaks_the_rules",
          suspensionMessage: "Repeated spam.",
        } as unknown as Organization,
        "members",
      ),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "GenAI Fund took Pocket Policy down" }),
    ).toBeVisible();
    expect(screen.getByText("Repeated spam.")).toBeVisible();
  });
});
