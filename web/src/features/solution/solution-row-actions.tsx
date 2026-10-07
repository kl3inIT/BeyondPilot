"use client";

import {
  CircleAlertIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  LinkIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { getPathname, Link } from "@/i18n/navigation";
import {
  deleteSolutionDraft,
  getMySolution,
  saveSolution,
  type SolutionSummary,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { held, reviewFields, toRequest } from "./solution-editor-state";
import { solutionError } from "./solution-errors";

type SolutionRowActionsProps = {
  solution: Pick<
    SolutionSummary,
    "id" | "slug" | "name" | "status" | "suspendedAt" | "listed" | "missing"
  >;
  /** False for a reader who may not change the organization's solutions: they open one, no more. */
  editable: boolean;
};

/**
 * What a member does with one solution from the list of their organization. Each state has its own
 * few actions: a draft is continued, sent or deleted; what is in review is read or edited; what was
 * sent back is fixed and sent again; what is approved is opened, shared, and hidden or shown.
 * Nothing that was sent for review is deleted, and nothing is withdrawn from review.
 */
function SolutionRowActions({ solution, editable }: SolutionRowActionsProps) {
  const t = useTranslations("Solution.mine.actions");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const [confirming, setConfirming] = useState<"delete" | "hide" | null>(null);
  const [pending, setPending] = useState(false);

  const editor = `${siteRoutes.workspaceSolutions}/${solution.id}`;
  const review = `${editor}?step=review`;
  const page = `${siteRoutes.solutions}/${solution.slug}`;
  // The name is always there, so it counts as filled.
  const filled = reviewFields.length - solution.missing.length;

  /** Lists the solution in the directory, or takes it out; its address keeps working either way. */
  async function list(listed: boolean) {
    setPending(true);
    try {
      const { data: found } = await getMySolution({ path: { id: solution.id } });
      await saveSolution({
        path: { id: solution.id },
        body: { ...toRequest(held(found), found.version), listed },
      });
      notify.success(listed ? "Solution.done.shown" : "Solution.done.hidden", {
        name: solution.name,
      });
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
      setConfirming(null);
    }
  }

  async function remove() {
    setPending(true);
    try {
      await deleteSolutionDraft({ path: { id: solution.id } });
      notify.success("Solution.done.deleted", { name: solution.name });
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
      setConfirming(null);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + getPathname({ href: page, locale }),
      );
      notify.success("Solution.done.linkCopied");
    } catch {
      notify.error("Solution.errors.linkNotCopied");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("open", { name: solution.name })}
              className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {!editable && (
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={editor} />}>
                <EyeIcon aria-hidden="true" />
                {t("view")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {editable && solution.status === "draft" && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={editor} />}>
                  <PencilIcon aria-hidden="true" />
                  {t("continue")}
                </DropdownMenuItem>
                {solution.missing.length === 0 ? (
                  <DropdownMenuItem render={<Link href={review} />}>
                    <SendIcon aria-hidden="true" />
                    {t("send")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>
                    <SendIcon className="self-start" aria-hidden="true" />
                    <span className="flex flex-col">
                      {t("send")}
                      <span className="text-xs">
                        {t("filled", { filled, total: reviewFields.length })}
                      </span>
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant="destructive" onClick={() => setConfirming("delete")}>
                  <Trash2Icon aria-hidden="true" />
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
          {editable && solution.status === "in_review" && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={review} />}>
                  <EyeIcon aria-hidden="true" />
                  {t("viewSent")}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={editor} />}>
                  <PencilIcon className="self-start" aria-hidden="true" />
                  <span className="flex flex-col">
                    {t("edit")}
                    <span className="text-xs text-muted-foreground">{t("editLive")}</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("inReview")}</DropdownMenuLabel>
              </DropdownMenuGroup>
            </>
          )}
          {editable && solution.status === "needs_changes" && (
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={editor} />}>
                <CircleAlertIcon aria-hidden="true" />
                {t("fix")}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={review} />}>
                <SendIcon aria-hidden="true" />
                {t("sendAgain")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {editable && solution.status === "rejected" && (
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={editor} />}>
                <EyeIcon aria-hidden="true" />
                {t("view")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {editable && solution.status === "approved" && solution.suspendedAt && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={editor} />}>
                  <PencilIcon aria-hidden="true" />
                  {t("edit")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t("takenDown")}</DropdownMenuLabel>
              </DropdownMenuGroup>
            </>
          )}
          {editable && solution.status === "approved" && !solution.suspendedAt && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={editor} />}>
                  <PencilIcon aria-hidden="true" />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={page} />}>
                  <ExternalLinkIcon aria-hidden="true" />
                  {t(solution.listed ? "viewPublic" : "openByLink")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyLink}>
                  <LinkIcon aria-hidden="true" />
                  {t("copyLink")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {solution.listed ? (
                  <DropdownMenuItem onClick={() => setConfirming("hide")}>
                    <EyeOffIcon aria-hidden="true" />
                    {t("hide")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled={pending} onClick={() => list(true)}>
                    <EyeIcon aria-hidden="true" />
                    {t("show")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirming === "delete"}
        onOpenChange={(next) => setConfirming(next ? "delete" : null)}
        title={t("confirmDelete.title", { name: solution.name })}
        description={t("confirmDelete.lead")}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={remove}
      />
      <ConfirmDialog
        open={confirming === "hide"}
        onOpenChange={(next) => setConfirming(next ? "hide" : null)}
        title={t("confirmHide.title")}
        description={t("confirmHide.lead")}
        confirmLabel={t("confirmHide.confirm")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => list(false)}
      />
    </>
  );
}

export { SolutionRowActions };
