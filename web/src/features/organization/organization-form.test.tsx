import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createOrganization,
  createOrganizationFromBasics,
  saveMyOrganization,
  type Organization,
} from "@/lib/api/generated";
import { render } from "@/test/render";

import { OrganizationForm } from "./organization-form";

vi.mock("@/lib/api/generated", async (original) => ({
  ...(await original<typeof import("@/lib/api/generated")>()),
  createOrganization: vi.fn(),
  createOrganizationFromBasics: vi.fn(),
  saveMyOrganization: vi.fn(),
}));

const choice = (name: string) => screen.getByRole("radio", { name });

describe("OrganizationForm, creating", () => {
  it("opens on a company, with the whole profile to write", () => {
    render(<OrganizationForm initialName="Pocket Policy" ownName="An Tran" />);

    expect(choice("A company")).toBeChecked();
    expect(screen.getByLabelText(/^Organization name/)).toHaveValue("Pocket Policy");
    expect(screen.getByLabelText(/^Website/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Short description/)).toBeInTheDocument();
    // The choice above says the type, so the select that says it on a saved profile is not drawn.
    expect(screen.queryByRole("combobox", { name: /^Type/ })).not.toBeInTheDocument();
  });

  it("asks a builder on their own for their name and country, and creates an organization of one", async () => {
    vi.mocked(createOrganizationFromBasics).mockResolvedValue({} as never);
    const { user } = render(<OrganizationForm initialName="Pocket Policy" ownName="An Tran" />);

    await user.click(choice("Just me"));

    expect(screen.getByLabelText(/^Your name/)).toHaveValue("An Tran");
    for (const asked of [/^Website/, /^Short description/, /^Year founded/]) {
      expect(screen.queryByLabelText(asked)).not.toBeInTheDocument();
    }
    expect(screen.queryByRole("combobox", { name: /^Team size/ })).not.toBeInTheDocument();

    // Without a country nothing is sent, and the country says what it lacks.
    await user.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByText("Select a country.")).toBeInTheDocument();
    expect(createOrganizationFromBasics).not.toHaveBeenCalled();

    await user.click(screen.getByRole("combobox", { name: /^Country/ }));
    await user.click(await screen.findByRole("option", { name: "Vietnam" }));
    await user.click(screen.getByRole("button", { name: "Send for review" }));

    await waitFor(() =>
      expect(createOrganizationFromBasics).toHaveBeenCalledWith({
        body: {
          name: "An Tran",
          type: "independent_builder",
          teamSize: "just_me",
          industries: [],
          country: "VN",
        },
      }),
    );
    expect(createOrganization).not.toHaveBeenCalled();
  });

  it("gives the searched name back when the person turns to a team", async () => {
    const { user } = render(<OrganizationForm initialName="Pocket Policy" ownName="An Tran" />);

    await user.click(choice("Just me"));
    await user.click(choice("A team"));

    expect(screen.getByLabelText(/^Organization name/)).toHaveValue("Pocket Policy");
    expect(screen.queryByLabelText(/^Team background/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Short description/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /^Team size/ })).toBeInTheDocument();
  });

  it("keeps a name the person wrote when the choice changes", async () => {
    const { user } = render(<OrganizationForm ownName="An Tran" />);

    await user.type(screen.getByLabelText(/^Organization name/), "Doc Team");
    await user.click(choice("Just me"));

    expect(screen.getByLabelText(/^Your name/)).toHaveValue("Doc Team");
  });
});

describe("OrganizationForm, changing a saved organization of one person", () => {
  const justMe = {
    id: "o1",
    slug: "an-tran",
    name: "An Tran",
    type: "independent_builder",
    status: "approved",
    country: "VN",
    teamSize: "just_me",
    industries: [],
    website: null,
    description: "Claims help from one person.",
    foundedYear: null,
    logoFileId: null,
    emailDomain: null,
    version: 3,
  } as unknown as Organization;

  it("offers every type, and a team or a company asks for a size other than just me", async () => {
    vi.mocked(saveMyOrganization).mockResolvedValue({} as never);
    const { user } = render(<OrganizationForm organization={justMe} />);

    await user.click(screen.getByRole("combobox", { name: /^Type/ }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "Company",
      "Builder team",
      "Just me",
      "Other",
    ]);
    await user.click(await screen.findByRole("option", { name: "Builder team" }));

    // The size of one person goes with the type, and the team says how big it is.
    expect(screen.getByRole("combobox", { name: /^Team size/ })).toHaveTextContent("Select a size");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Select a team size.")).toBeInTheDocument();
    expect(saveMyOrganization).not.toHaveBeenCalled();

    await user.click(screen.getByRole("combobox", { name: /^Team size/ }));
    expect(screen.queryByRole("option", { name: "Just me" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("option", { name: "2–9 people" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(saveMyOrganization).toHaveBeenCalledWith({
        body: expect.objectContaining({ type: "builder_team", teamSize: "2_9", version: 3 }),
      }),
    );
  });

  it("goes back to just me with the size of one person", async () => {
    vi.mocked(saveMyOrganization).mockResolvedValue({} as never);
    const team = { ...justMe, type: "builder_team", teamSize: "2_9" } as Organization;
    const { user } = render(<OrganizationForm organization={team} />);

    await user.click(screen.getByRole("combobox", { name: /^Type/ }));
    await user.click(await screen.findByRole("option", { name: "Just me" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(saveMyOrganization).toHaveBeenCalledWith({
        body: expect.objectContaining({ type: "independent_builder", teamSize: "just_me" }),
      }),
    );
  });
});
