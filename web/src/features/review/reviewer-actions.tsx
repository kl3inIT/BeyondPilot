"use client";

import { MoreHorizontalIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  inviteReviewer,
  removeReviewer,
  resendReviewerInvitation,
  saveReviewCriteria,
  type ReviewCriterion,
} from "@/lib/api/generated";

function errorKey(error: unknown) {
  const code = error instanceof ApiError ? error.code : undefined;
  return code === "PROPOSAL_REVIEWER_INVITED" ||
    code === "PROPOSAL_REVIEWER_JOINED" ||
    code === "PROPOSAL_CRITERIA_FIXED" ||
    code === "PROPOSAL_CRITERIA_INVALID"
    ? (`Review.errors.${code}` as const)
    : ("Review.errors.unknown" as const);
}

/** Invites an address to judge the program; the person signs in with it and finds the program. */
function InviteReviewer({ programId, programName }: { programId: string; programName: string }) {
  const t = useTranslations("Review.reviewers.invite");
  const notify = useNotify();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setInvalid(true);
      return;
    }
    setPending(true);
    try {
      await inviteReviewer({ path: { programId }, body: { email: email.trim() } });
      notify.success("Review.reviewers.invite.sent", { email: email.trim() });
      setOpen(false);
      setEmail("");
      router.refresh();
    } catch (error) {
      notify.error(errorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("open")}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form onSubmit={submit} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t("title", { program: programName })}</DialogTitle>
              <DialogDescription>{t("description")}</DialogDescription>
            </DialogHeader>
            <Field data-invalid={invalid || undefined}>
              <FieldLabel htmlFor="reviewer-email">{t("email")}</FieldLabel>
              <Input
                id="reviewer-email"
                type="email"
                autoComplete="off"
                value={email}
                aria-invalid={invalid || undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setInvalid(false);
                }}
              />
              {invalid ? (
                <FieldError>{t("invalid")}</FieldError>
              ) : (
                <FieldDescription>{t("note")}</FieldDescription>
              )}
            </Field>
            <DialogFooter>
              <Button prominence="secondary" type="button" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" pending={pending}>
                {t("send")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
      notify.error(errorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton aria-label={t("actions", { email })} size="sm" prominence="tertiary" />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
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

type Draft = { name: string; description: string };

/**
 * Edits a program's judging criteria in a dialog, in order, and saves them together. They are
 * fixed once an application has been scored on them.
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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, setPending] = useState(false);
  const filled = drafts.length > 0 && drafts.every((draft) => draft.name.trim() !== "");

  function start() {
    setDrafts(
      criteria.length > 0
        ? criteria.map((criterion) => ({
            name: criterion.name,
            description: criterion.description ?? "",
          }))
        : [{ name: "", description: "" }],
    );
    setOpen(true);
  }

  async function save() {
    setPending(true);
    try {
      await saveReviewCriteria({
        path: { programId },
        body: {
          criteria: drafts.map((draft) => ({
            name: draft.name.trim(),
            description: draft.description.trim() === "" ? null : draft.description.trim(),
          })),
        },
      });
      notify.success("Review.criteria.saved");
      setOpen(false);
      router.refresh();
    } catch (error) {
      notify.error(errorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button prominence="secondary" size="sm" onClick={start}>
        {criteria.length > 0 ? t("edit") : t("add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>
          <ol className="flex flex-col gap-3 overflow-y-auto">
            {drafts.map((draft, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-2 w-5 text-sm text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Input
                    aria-label={t("name", { number: index + 1 })}
                    placeholder={t("namePlaceholder")}
                    value={draft.name}
                    maxLength={80}
                    onChange={(event) =>
                      setDrafts(
                        drafts.map((item, at) =>
                          at === index ? { ...item, name: event.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label={t("description", { number: index + 1 })}
                    placeholder={t("descriptionPlaceholder")}
                    value={draft.description}
                    maxLength={300}
                    onChange={(event) =>
                      setDrafts(
                        drafts.map((item, at) =>
                          at === index ? { ...item, description: event.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <IconButton
                  aria-label={t("remove", { number: index + 1 })}
                  prominence="tertiary"
                  size="sm"
                  disabled={drafts.length === 1}
                  onClick={() => setDrafts(drafts.filter((_, at) => at !== index))}
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
            disabled={drafts.length >= 12}
            onClick={() => setDrafts([...drafts, { name: "", description: "" }])}
          >
            <PlusIcon aria-hidden="true" />
            {t("addOne")}
          </Button>
          <DialogFooter>
            <Button prominence="secondary" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button pending={pending} disabled={!filled} onClick={save}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CriteriaEditor, InviteReviewer, ReviewerRowActions };
