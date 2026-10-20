"use client";

import { CloudAlertIcon, CloudCheckIcon, CloudUploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { keepReleaseDraft, releaseOutcomes, type ReleaseEmails } from "@/lib/api/generated";
import { clockText } from "@/i18n/formats";

import { type OutcomeRecipient, unknownPlaceholders } from "./outcome-placeholders";
import { OutcomeLinkPopover } from "./outcome-link-popover";
import { OutcomePreview } from "./outcome-preview";

/** How long after the last key the emails are saved. */
const SAVE_AFTER_MS = 1200;

type ReleaseFormProps = {
  programId: string;
  emails: ReleaseEmails;
  /** Who gets each group's email, with the names that fill it in. */
  recipients: { shortlisted: OutcomeRecipient[]; notSelected: OutcomeRecipient[] };
  /** The program's applications have closed and every one has a decision. */
  ready: boolean;
  /** The words of what still holds the release back, when it is not ready. */
  blocked: string | null;
  released: boolean;
};

/**
 * The email each group gets, written by the operator, and the release itself. What is typed is
 * saved as the operator goes, so that it is there when the page is opened again; nothing is sent
 * until the release. Each group's email is previewed as one of its applicants gets it, and a
 * placeholder the backend would not fill in holds the release back. Releasing asks again, naming how
 * many applicants of each group get their email: an email cannot be taken back.
 */
function ReleaseForm({
  programId,
  emails,
  recipients,
  ready,
  blocked,
  released,
}: ReleaseFormProps) {
  const t = useTranslations("Review.release");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const [draft, setDraft] = useState(emails);
  const [asking, setAsking] = useState(false);
  const [pending, setPending] = useState(false);
  // Whether what is on the screen is on the server too, and when it last got there.
  const [unsaved, setUnsaved] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Counts the changes, so that a save that answers after a later key does not say "saved".
  const edits = useRef(0);
  // Saves go one after another: an earlier one never lands on top of a later one.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const messages = {
    shortlisted: useRef<HTMLTextAreaElement>(null),
    notSelected: useRef<HTMLTextAreaElement>(null),
  };
  const filled = Object.values(draft).every((value) => value.trim() !== "");
  const counts = {
    shortlisted: recipients.shortlisted.length,
    notSelected: recipients.notSelected.length,
  };
  const unknown = {
    shortlisted: unknownPlaceholders(draft.shortlistedSubject, draft.shortlistedMessage),
    notSelected: unknownPlaceholders(draft.notSelectedSubject, draft.notSelectedMessage),
  };
  const mistyped = unknown.shortlisted.length + unknown.notSelected.length > 0;

  function write(next: ReleaseEmails) {
    edits.current += 1;
    setDraft(next);
    setUnsaved(true);
  }

  useEffect(() => {
    if (edits.current === 0) {
      return;
    }
    const edit = edits.current;
    const timer = setTimeout(() => {
      saving.current = saving.current
        .then(() => keepReleaseDraft({ path: { programId }, body: draft }))
        .then(() => {
          setSaveFailed(false);
          if (edits.current === edit) {
            setUnsaved(false);
            setSavedAt(new Date());
          }
        })
        .catch(() => setSaveFailed(true));
    }, SAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [draft, programId]);

  async function release() {
    setPending(true);
    try {
      // The release sends what is on the screen; a save still on its way must not follow it.
      await saving.current;
      await releaseOutcomes({ path: { programId }, body: draft });
      edits.current = 0;
      setUnsaved(false);
      setAsking(false);
      notify.success("Review.release.done");
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  const group = (key: "shortlisted" | "notSelected") => (
    <div className="flex flex-col gap-3 pt-2">
      <Field>
        <FieldLabel htmlFor={`${key}-subject`}>{t("subject")}</FieldLabel>
        <Input
          id={`${key}-subject`}
          value={draft[`${key}Subject`]}
          maxLength={200}
          readOnly={released}
          onChange={(event) => write({ ...draft, [`${key}Subject`]: event.target.value })}
        />
      </Field>
      <Field>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor={`${key}-message`}>{t("message")}</FieldLabel>
          {!released && (
            <OutcomeLinkPopover
              id={key}
              textarea={messages[key]}
              onAdd={(message) => write({ ...draft, [`${key}Message`]: message })}
            />
          )}
        </div>
        <Textarea
          ref={messages[key]}
          id={`${key}-message`}
          rows={10}
          value={draft[`${key}Message`]}
          maxLength={5000}
          readOnly={released}
          onChange={(event) => write({ ...draft, [`${key}Message`]: event.target.value })}
        />
        <FieldDescription>
          {t("placeholders", { organization: "{organization}", solution: "{solution}" })}
        </FieldDescription>
        {!released && unknown[key].length > 0 && (
          <FieldError>
            {t("unknown", {
              placeholders: unknown[key].join(", "),
              organization: "{organization}",
              solution: "{solution}",
            })}
          </FieldError>
        )}
      </Field>
      <OutcomePreview
        id={`${key}-preview`}
        subject={draft[`${key}Subject`]}
        message={draft[`${key}Message`]}
        recipients={recipients[key]}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-labelledby="release-emails"
        className="flex flex-col gap-2 rounded-lg border bg-card p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 id="release-emails" className="text-base font-semibold">
            {released ? t("sentTitle") : t("emailsTitle")}
          </h2>
          {!released && (unsaved || savedAt) && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              {saveFailed ? (
                <CloudAlertIcon className="size-4 text-destructive" aria-hidden="true" />
              ) : unsaved ? (
                <CloudUploadIcon className="size-4" aria-hidden="true" />
              ) : (
                <CloudCheckIcon className="size-4 text-success" aria-hidden="true" />
              )}
              {saveFailed
                ? t("draft.failed")
                : unsaved || !savedAt
                  ? t("draft.unsaved")
                  : t("draft.saved", {
                      time: clockText(format, savedAt),
                    })}
            </span>
          )}
        </div>
        <Tabs defaultValue="shortlisted">
          <TabsList variant="line">
            <TabsTrigger value="shortlisted">
              {t("groups.shortlisted")}
              <span className="text-muted-foreground tabular-nums">{counts.shortlisted}</span>
            </TabsTrigger>
            <TabsTrigger value="notSelected">
              {t("groups.notSelected")}
              <span className="text-muted-foreground tabular-nums">{counts.notSelected}</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="shortlisted">{group("shortlisted")}</TabsContent>
          <TabsContent value="notSelected">{group("notSelected")}</TabsContent>
        </Tabs>
      </section>
      {!released && (
        <section
          aria-label={t("confirmLabel")}
          className="flex flex-col gap-3 rounded-lg border bg-card p-5"
        >
          <p className="text-sm text-muted-foreground">
            {!ready
              ? (blocked ?? t("notReady"))
              : !filled
                ? t("fillFirst")
                : mistyped
                  ? t("fixFirst")
                  : t("checkFirst")}
          </p>
          <Button disabled={!ready || !filled || mistyped} onClick={() => setAsking(true)}>
            {t("release", { count: counts.shortlisted + counts.notSelected })}
          </Button>
        </section>
      )}
      <ConfirmDialog
        open={asking}
        onOpenChange={setAsking}
        title={t("confirm.title", { count: counts.shortlisted + counts.notSelected })}
        description={t("confirm.lead")}
        note={t("confirm.note")}
        confirmLabel={t("confirm.send")}
        cancelLabel={t("confirm.cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => void release()}
      >
        <ul className="flex flex-col gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          {(["shortlisted", "notSelected"] as const).map((key) => (
            <li key={key} className="flex flex-col">
              <span className="font-medium">
                {t("confirm.group", { group: t(`groups.${key}`), count: counts[key] })}
              </span>
              <span className="break-words text-muted-foreground">{draft[`${key}Subject`]}</span>
            </li>
          ))}
        </ul>
      </ConfirmDialog>
      <LeaveGuard
        active={unsaved && !pending && !released}
        title={t("draft.leave.title")}
        description={t("draft.leave.lead")}
        leaveLabel={t("draft.leave.leave")}
        stayLabel={t("draft.leave.stay")}
      />
    </div>
  );
}

export { ReleaseForm };
