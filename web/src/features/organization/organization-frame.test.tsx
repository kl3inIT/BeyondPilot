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
  status: "in_review",
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
  it("is an ordinary organization: its type is named and it has the profile and members tabs", () => {
    render(frame({ ...complete, type: "independent_builder", status: "approved" }, "members"));

    expect(screen.getByText("Just me")).toBeVisible();
    expect(screen.getByRole("link", { name: /Profile/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Members/ })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Complete profile" })).not.toBeInTheDocument();
  });

  it("waits for review like any organization once it became a team or a company", () => {
    render(
      frame(
        { ...complete, type: "independent_builder", status: "in_review", description: "" },
        "members",
      ),
    );

    expect(screen.getByRole("link", { name: "Complete profile" })).toBeVisible();
  });
});

describe("OrganizationFrame, while the organization is in review", () => {
  it("counts and names what the profile lacks, and leads its owner to complete it", () => {
    render(frame({ ...complete, website: null, foundedYear: null, description: "" }, "members"));

    expect(
      screen.getByText(
        "3 required fields are empty: Website, Year founded, and Short description. The reviewer reads the profile as it is now.",
      ),
    ).toBeVisible();
    const action = screen.getByRole("link", { name: "Complete profile" });
    expect(action).toHaveAttribute("data-prominence", "primary");
    expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  });

  it("does not ask a team for what only a company must give", () => {
    render(
      frame(
        {
          ...complete,
          type: "builder_team",
          website: null,
          foundedYear: null,
          teamBackground: "Built claims assistants.",
        },
        "members",
      ),
    );

    expect(screen.getByText("The profile has every required field.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Edit profile" })).toHaveAttribute(
      "data-prominence",
      "secondary",
    );
  });

  it("tells a member what is missing without an action they cannot take", () => {
    render(frame({ ...complete, website: null }, "members", "member"));

    expect(screen.getByText(/^1 required field is empty: Website\./)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Complete profile" })).not.toBeInTheDocument();
  });

  it("leaves the action to the profile itself on the Profile tab", () => {
    render(frame({ ...complete, website: null }, "profile"));

    expect(screen.getByText(/^1 required field is empty/)).toBeVisible();
    expect(screen.queryByRole("link", { name: "Complete profile" })).not.toBeInTheDocument();
  });
});
