"use client";

import { EllipsisIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { Link, useRouter } from "@/i18n/navigation";
import { moveMyUseCaseToDraft, type MyUseCaseSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { describeUseCaseError } from "./my-use-case-errors";

type MyUseCaseActionsProps = {
  useCase: Pick<MyUseCaseSummary, "id" | "status" | "title">;
};

/**
 * The menu of one row of the tab. What it offers follows the status: a draft or a use case sent back
 * is edited, one in review is opened and can be pulled back, a published one is edited after a
 * warning that GenAI Fund reviews it again, or moved back to a draft, and a closed one is only opened.
 */
function MyUseCaseActions({ useCase }: MyUseCaseActionsProps) {
  const t = useTranslations("Organization.useCases");
  const notify = useNotify();
  const router = useRouter();
  const [confirming, setConfirming] = useState<"edit" | "draft" | null>(null);
  const [pending, setPending] = useState(false);
  const name = useCase.title ?? t("untitled");
  const address = `${siteRoutes.workspaceUseCases}/${useCase.id}`;

  const status = useCase.status;
  const editable = status === "draft" || status === "needs_changes";
  const published = status === "approved";
  const inReview = status === "in_review";

  async function toDraft() {
    setPending(true);
    try {
      await moveMyUseCaseToDraft({ path: { id: useCase.id } });
      notify.success("Organization.useCases.done.draft", { name });
      setConfirming(null);
      router.refresh();
    } catch (error) {
      notify.error(describeUseCaseError(error));
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("actions.open", { name })}
              className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
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
            {published && (
              <DropdownMenuItem onClick={() => setConfirming("edit")}>
                {t("actions.edit")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          {(inReview || published) && <DropdownMenuSeparator />}
          {(inReview || published) && (
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant={published ? "destructive" : undefined}
                onClick={() => (published ? setConfirming("draft") : void toDraft())}
              >
                {t(published ? "actions.moveToDraft" : "actions.pullBack")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === "edit"}
        onOpenChange={(open) => setConfirming(open ? "edit" : null)}
        title={t("editPublished.title")}
        description={t("editPublished.description")}
        confirmLabel={t("editPublished.confirm")}
        cancelLabel={t("cancel")}
        pending={false}
        onConfirm={() => router.push(address)}
      />
      <ConfirmDialog
        open={confirming === "draft"}
        onOpenChange={(open) => setConfirming(open ? "draft" : null)}
        title={t("moveToDraft.title", { name })}
        description={t("moveToDraft.description")}
        confirmLabel={t("moveToDraft.confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => void toDraft()}
      />
    </>
  );
}

export { MyUseCaseActions };
