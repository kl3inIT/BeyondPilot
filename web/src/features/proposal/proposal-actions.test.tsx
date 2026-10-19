import { screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import type { UseCaseProposalForm } from "@/lib/api/generated";
import { render } from "@/test/render";

import messages from "../../../messages/en.json";

import { ProposalActions } from "./proposal-actions";

const { account, readForm } = vi.hoisted(() => ({
  account: vi.fn<() => Promise<{ id: string } | null>>(),
  readForm: vi.fn<() => Promise<{ data: UseCaseProposalForm }>>(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentAccount: account,
  sessionRequest: async () => ({}),
}));
vi.mock("@/lib/api/generated", () => ({ getUseCaseProposalForm: readForm }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "UseCases.detail" | "UseCaseProposal.actions") =>
    createTranslator({ locale: "en", messages, namespace }),
}));
vi.mock("@/i18n/format-server", () => ({
  getFormatter: async () => ({ dateTime: () => "1 Oct 2026" }),
}));

const useCase = { id: "u", title: "Claims intake" };
const draft = {
  id: "p",
  status: "draft" as const,
  solutions: [],
  updatedAt: "2026-10-01T00:00:00Z",
  version: 1,
};
const closed = { useCaseId: useCase.id, closesAt: "2020-10-15T16:59:00Z" };

describe("proposal actions after the deadline", () => {
  beforeEach(() => {
    account.mockReset().mockResolvedValue(null);
    readForm.mockReset().mockResolvedValue({ data: { useCase } });
  });

  it("keeps a disabled deadline button for visitors instead of a link to submit", async () => {
    render(await ProposalActions(closed));

    expect(screen.getByRole("button", { name: "Proposals closed" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it.each([
    ["new", null],
    ["draft", draft],
    ["withdrawn", { ...draft, withdrawnAt: "2020-10-01T00:00:00Z" }],
  ] as const)("does not offer submission for a signed-in %s proposal", async (_, proposal) => {
    account.mockResolvedValue({ id: "a" });
    readForm.mockResolvedValue({ data: { useCase, proposal } });
    render(await ProposalActions(closed));

    expect(screen.getByRole("button", { name: "Proposals closed" })).toBeDisabled();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps the disabled control when the form refuses late submissions", async () => {
    account.mockResolvedValue({ id: "a" });
    readForm.mockRejectedValue(
      new ApiError(409, {
        code: "PROPOSAL_USE_CASE_CLOSED",
        status: 409,
        title: "Conflict",
        requestId: "closed-read",
      }),
    );
    render(await ProposalActions(closed));

    expect(screen.getByRole("button", { name: "Proposals closed" })).toBeDisabled();
  });

  it("still lets senders read their sent proposal without offering editing", async () => {
    account.mockResolvedValue({ id: "a" });
    readForm.mockResolvedValue({
      data: {
        useCase,
        proposal: { ...draft, status: "sent", sentAt: draft.updatedAt, editableUntil: null },
      },
    });
    render(await ProposalActions(closed));

    expect(
      screen.getByRole("link", { name: messages.UseCaseProposal.actions.view }),
    ).toHaveAttribute("href", "/use-cases/u/propose/view");
    expect(
      screen.queryByRole("link", { name: messages.UseCaseProposal.actions.edit }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Proposals closed" })).not.toBeInTheDocument();
  });

  it("still lets the posting organization review received proposals", async () => {
    account.mockResolvedValue({ id: "a" });
    readForm.mockRejectedValue(
      new ApiError(403, {
        code: "PROPOSAL_OWN_USE_CASE",
        status: 403,
        title: "Forbidden",
        requestId: "own-read",
      }),
    );
    render(await ProposalActions(closed));

    expect(
      screen.getByRole("link", { name: messages.UseCaseProposal.actions.viewReceived }),
    ).toHaveAttribute("href", "/workspace/organization/use-cases/u/proposals");
    expect(screen.queryByRole("button", { name: "Proposals closed" })).not.toBeInTheDocument();
  });

  it("preserves sending when there is no deadline", async () => {
    render(await ProposalActions({ useCaseId: useCase.id, closesAt: null }));

    expect(screen.getByRole("link", { name: "Send a proposal" })).toHaveAttribute(
      "href",
      "/use-cases/u/propose",
    );
    expect(screen.queryByRole("button", { name: "Proposals closed" })).not.toBeInTheDocument();
  });
});

describe("proposal actions on a use case of a challenge taking applications", () => {
  const challenge = { name: "Claims challenge", slug: "claims", closesAt: "2099-01-01T00:00:00Z" };
  const open = { useCaseId: useCase.id, closesAt: null, challenge };

  beforeEach(() => {
    account.mockReset().mockResolvedValue({ id: "a" });
  });

  it("leads a visitor to the challenge's application instead of a proposal", async () => {
    account.mockResolvedValue(null);
    render(await ProposalActions(open));

    expect(screen.getByRole("link", { name: "Apply to the challenge" })).toHaveAttribute(
      "href",
      "/programs/claims/apply",
    );
    expect(screen.queryByRole("link", { name: "Send a proposal" })).not.toBeInTheDocument();
  });

  it("leads an organization with a draft to the challenge too", async () => {
    readForm.mockRejectedValue(
      new ApiError(409, {
        code: "PROPOSAL_USE_CASE_IN_CHALLENGE",
        status: 409,
        title: "Conflict",
        requestId: "challenge-read",
      }),
    );
    render(await ProposalActions(open));

    expect(screen.getByRole("link", { name: "Apply to the challenge" })).toBeInTheDocument();
  });

  it("still shows the proposal an organization sent before", async () => {
    readForm.mockResolvedValue({
      data: { useCase, proposal: { ...draft, status: "sent", sentAt: "2026-10-01T00:00:00Z" } },
    });
    render(await ProposalActions(open));

    expect(screen.getByRole("link", { name: "View proposal" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Apply to the challenge" })).not.toBeInTheDocument();
  });
});
