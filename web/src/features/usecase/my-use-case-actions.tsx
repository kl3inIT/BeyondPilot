"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { Link, useRouter } from "@/i18n/navigation";
import {
  makeMyUseCasePrivate,
  makeMyUseCasePublic,
  moveMyUseCaseToDraft,
  type MyUseCaseSummary,
} from "@/lib/api/generated";
import { siteRoutes, workspaceUseCaseProposalsRoute } from "@/lib/site";

import { useCaseWords } from "./my-use-case-errors";

type MyUseCaseActionsProps = {
  useCase: Pick<MyUseCaseSummary, "id" | "status" | "title">;
  /** Whether the use case was published, so that it can have received proposals. */
  viewProposals: boolean;
};

/**
 * The menu of one row of the tab. What it offers follows the status: a draft, a use case sent back, a
 * public one and a private one are edited; one in review is opened and can be pulled back; a closed
 * one is only opened. A public use case can be made private and a private one public again, with no
 * review once GenAI Fund approved it.
 */
function MyUseCaseActions({ useCase, viewProposals }: MyUseCaseActionsProps) {
  const t = useTranslations("Organization.useCases");
  const p = useTranslations("UseCaseProposal.received");
  const notify = useNotify();
  const router = useRouter();
  const [confirming, setConfirming] = useState<"private" | "public" | null>(null);
  const [pending, setPending] = useState(false);
  const name = useCase.title ?? t("untitled");
  const address = `${siteRoutes.workspaceUseCases}/${useCase.id}`;

  const status = useCase.status;
  const editable =
    status === "draft" ||
    status === "needs_changes" ||
    status === "approved" ||
    status === "private";
  const inReview = status === "in_review";

  async function change(
    action: () => Promise<unknown>,
    done:
      | "Organization.useCases.done.draft"
      | "Organization.useCases.done.private"
      | "Organization.useCases.done.public",
  ) {
    setPending(true);
    try {
      await action();
      notify.success(done, { name });
      setConfirming(null);
      router.refresh();
    } catch (error) {
      notify.failure(error, useCaseWords);
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label={t("actions.open", { name })} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {editable && (
              <DropdownMenuItem render={<Link href={address} />}>
                {t("actions.edit")}
              </DropdownMenuItem>
            )}
            {(inReview || status === "closed") && (
              <DropdownMenuItem render={<Link href={address} />}>
                {t("actions.view")}
              </DropdownMenuItem>
            )}
            {viewProposals && (
              <DropdownMenuItem render={<Link href={workspaceUseCaseProposalsRoute(useCase.id)} />}>
                {p("viewProposals")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {(inReview || status === "approved" || status === "private") && <DropdownMenuSeparator />}
          {inReview && (
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  void change(
                    () => moveMyUseCaseToDraft({ path: { id: useCase.id } }),
                    "Organization.useCases.done.draft",
                  )
                }
              >
                {t("actions.pullBack")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {status === "approved" && (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setConfirming("private")}>
                {t("actions.makePrivate")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {status === "private" && (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setConfirming("public")}>
                {t("actions.makePublic")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === "private"}
        onOpenChange={(open) => setConfirming(open ? "private" : null)}
        title={t("makePrivate.title", { name })}
        description={t("makePrivate.description")}
        confirmLabel={t("makePrivate.confirm")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() =>
          void change(
            () => makeMyUseCasePrivate({ path: { id: useCase.id } }),
            "Organization.useCases.done.private",
          )
        }
      />
      <ConfirmDialog
        open={confirming === "public"}
        onOpenChange={(open) => setConfirming(open ? "public" : null)}
        title={t("makePublic.title", { name })}
        description={t("makePublic.description")}
        confirmLabel={t("makePublic.confirm")}
        cancelLabel={t("cancel")}
        pending={pending}
        onConfirm={() =>
          void change(
            () => makeMyUseCasePublic({ path: { id: useCase.id } }),
            "Organization.useCases.done.public",
          )
        }
      />
    </>
  );
}

export { MyUseCaseActions };
