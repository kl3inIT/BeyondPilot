import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ConversationSubject } from "@/lib/api/generated";
import { render } from "@/test/render";

import { ConversationDetails } from "./conversation-details";

const subject: ConversationSubject = {
  kind: "solution",
  name: "Claims assistant",
  organizationName: "Provider",
  customerDeployments: 0,
  industries: [],
  roles: [],
  skills: [],
};

describe("ConversationDetails, organization access", () => {
  it("lets an owner add or remove a current member of their side", async () => {
    const change = vi.fn().mockResolvedValue(undefined);
    const member = {
      accountId: "00000000-0000-0000-0000-000000000001",
      name: "Alex",
      email: "alex@example.test",
      included: false,
    };
    const props = {
      subject,
      participants: [],
      side: "starter" as const,
      onChangeMember: change,
    };
    const { user, rerender } = render(
      <ConversationDetails {...props} manageableMembers={[member]} />,
    );

    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(change).toHaveBeenCalledWith(member.accountId, true);

    rerender(
      <ConversationDetails {...props} manageableMembers={[{ ...member, included: true }]} />,
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(change).toHaveBeenCalledWith(member.accountId, false);
  });

  it("shows no member controls to readers without owner management rights", () => {
    render(<ConversationDetails subject={subject} participants={[]} side="starter" />);
    expect(screen.queryByText("Your organization's access")).not.toBeInTheDocument();
  });
});
