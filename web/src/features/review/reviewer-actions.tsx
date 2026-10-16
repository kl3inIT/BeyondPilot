"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import {
  inviteReviewer,
  removeReviewer,
  resendReviewerInvitation,
  saveReviewCriteria,
  type ReviewCriterion,
} from "@/lib/api/generated";

import { POINT_CHOICES } from "./review-points";

/** Invites an address to judge the program; the person signs in with it and finds the program. */
function InviteReviewer({ programId, programName }: { programId: string; programName: string }) {
  const t = useTranslations("Review.reviewers.invite");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: { email: "" },
    validationLogic: revalidateLogic(),
    validators: {
      onDynamic: z.object({
        email: z
          .string()
          .trim()
          .regex(/^\S+@\S+\.\S+$/, t("invalid")),
      }),
    },
    onSubmit: async ({ value }) => {
      const email = value.email.trim();
      try {
        await inviteReviewer({ path: { programId }, body: { email } });
        notify.success("Review.reviewers.invite.sent", { email });
        setOpen(false);
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("open")}</Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("title", { program: programName })}
        description={t("description")}
        submitLabel={t("send")}
        cancelLabel={t("cancel")}
      >
        <form.AppField name="email">
          {(field) => <field.TextField label={t("email")} type="email" autoComplete="off" />}
        </form.AppField>
      </FormDialog>
    </>
  );
}

/** What can be done with one judge: send an unused invitation again, or remove them. */
function ReviewerRowActions({
  programId,
  reviewerId,
  email,
  canResend,
}: {
  programId: string;
  reviewerId: string;
  email: string;
  canResend: boolean;
}) {
  const t = useTranslations("Review.reviewers.row");
  const notify = useNotify();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function act(action: "resend" | "remove") {
    setPending(true);
    try {
      if (action === "resend") {
        await resendReviewerInvitation({ path: { programId, reviewerId } });
        notify.success("Review.reviewers.row.resent", { email });
      } else {
        await removeReviewer({ path: { programId, reviewerId } });
        notify.success("Review.reviewers.row.removed", { email });
        setConfirming(false);
      }
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label={t("actions", { email })} />
        <DropdownMenuContent align="end">
          {canResend && (
            <DropdownMenuItem onClick={() => act("resend")}>{t("resend")}</DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onClick={() => setConfirming(true)}>
            {t("remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={t("confirm.title")}
        description={t("confirm.description", { email })}
        note={t("confirm.note")}
        confirmLabel={t("confirm.remove")}
        cancelLabel={t("confirm.keep")}
        tone="danger"
        pending={pending}
        onConfirm={() => act("remove")}
      />
    </>
  );
}

/** The most criteria a program is judged on. */
const MAX_CRITERIA = 12;

/** A criterion's points as the select holds them: a number, or none. */
const NO_POINTS = "none";

/**
 * Edits a program's judging criteria in a dialog, in order, and saves them together. Each may be
 * worth points, every one or none. They are fixed once an application has been scored on them.
 */
function CriteriaEditor({
  programId,
  criteria,
}: {
  programId: string;
  criteria: ReviewCriterion[];
}) {
  const t = useTranslations("Review.criteria");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const form = useAppForm({
    defaultValues: {
      criteria:
        criteria.length > 0
          ? criteria.map((criterion) => ({
              name: criterion.name,
              description: criterion.description ?? "",
              points: criterion.maxPoints == null ? NO_POINTS : String(criterion.maxPoints),
            }))
          : [{ name: "", description: "", points: NO_POINTS }],
    },
    onSubmit: async ({ value }) => {
      try {
        await saveReviewCriteria({
          path: { programId },
          body: {
            criteria: value.criteria.map((draft) => ({
              name: draft.name.trim(),
              description: draft.description.trim() === "" ? null : draft.description.trim(),
              maxPoints: draft.points === NO_POINTS ? null : Number(draft.points),
            })),
          },
        });
        notify.success("Review.criteria.saved");
        setOpen(false);
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });
  const drafts = useStore(form.store, (state) => state.values.criteria);
  const filled = drafts.length > 0 && drafts.every((draft) => draft.name.trim() !== "");
  const worth = drafts.filter((draft) => draft.points !== NO_POINTS);
  // Points add up to a total only when every criterion has them.
  const mixed = worth.length > 0 && worth.length < drafts.length;
  const totalPoints = worth.reduce((sum, draft) => sum + Number(draft.points), 0);

  return (
    <>
      <Button prominence="secondary" size="sm" onClick={() => setOpen(true)}>
        {criteria.length > 0 ? t("edit") : t("add")}
      </Button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title={t("dialogTitle")}
        description={t("dialogDescription")}
        width="xl"
        submitLabel={t("save")}
        cancelLabel={t("cancel")}
        submitDisabled={!filled || mixed}
      >
        <form.Field name="criteria" mode="array">
          {(list) => (
            <>
              <ol className="flex flex-col gap-3">
                {list.state.value.map((_, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="w-5 text-sm text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex flex-1 flex-col gap-3">
                      <form.AppField name={`criteria[${index}].name`}>
                        {(field) => (
                          <field.TextField
                            label={t("nameLabel")}
                            maxLength={80}
                            description={t("nameHint")}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name={`criteria[${index}].description`}>
                        {(field) => (
                          <field.TextField
                            label={t("descriptionLabel")}
                            optional
                            maxLength={300}
                            description={t("descriptionHint")}
                          />
                        )}
                      </form.AppField>
                      <form.AppField name={`criteria[${index}].points`}>
                        {(field) => (
                          <field.SelectField
                            label={t("pointsLabel")}
                            optional
                            description={t("pointsHint")}
                            options={[
                              { value: NO_POINTS, label: t("noPoints") },
                              ...POINT_CHOICES.map((points) => ({
                                value: String(points),
                                label: String(points),
                              })),
                            ]}
                          />
                        )}
                      </form.AppField>
                    </div>
                    <IconButton
                      aria-label={t("remove", { number: index + 1 })}
                      prominence="tertiary"
                      size="sm"
                      disabled={list.state.value.length === 1}
                      onClick={() => list.removeValue(index)}
                    >
                      <Trash2Icon aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ol>
              <Button
                prominence="tertiary"
                size="sm"
                className="self-start"
                disabled={list.state.value.length >= MAX_CRITERIA}
                onClick={() => list.pushValue({ name: "", description: "", points: NO_POINTS })}
              >
                <PlusIcon aria-hidden="true" />
                {t("addOne")}
              </Button>
              {(worth.length > 0 || mixed) && (
                <p role="status" className="text-sm text-muted-foreground">
                  {mixed ? t("pointsMixed") : t("pointsTotal", { total: totalPoints })}
                </p>
              )}
            </>
          )}
        </form.Field>
      </FormDialog>
    </>
  );
}

export { CriteriaEditor, InviteReviewer, ReviewerRowActions };
