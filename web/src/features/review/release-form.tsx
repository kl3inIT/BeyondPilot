"use client";

import { CloudAlertIcon, CloudCheckIcon, CloudUploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { keepReleaseDraft, releaseOutcomes, type ReleaseEmails } from "@/lib/api/generated";

/** How long after the last key the emails are saved. */
const SAVE_AFTER_MS = 1200;

type ReleaseFormProps = {
  programId: string;
  emails: ReleaseEmails;
  counts: { shortlisted: number; notSelected: number };
  /** The program's applications have closed and every one has a decision. */
  ready: boolean;
  /** The words of what still holds the release back, when it is not ready. */
  blocked: string | null;
  released: boolean;
};

/**
 * The email each group gets, written by the operator, and the release itself. What is typed is
 * saved as the operator goes, so that it is there when the page is opened again; nothing is sent
 * until the release. Releasing asks the operator to say they checked both lists: an email cannot
 * be taken back.
 */
function ReleaseForm({ programId, emails, counts, ready, blocked, released }: ReleaseFormProps) {
  const t = useTranslations("Review.release");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const [draft, setDraft] = useState(emails);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  // Whether what is on the screen is on the server too, and when it last got there.
  const [unsaved, setUnsaved] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // Counts the changes, so that a save that answers after a later key does not say "saved".
  const edits = useRef(0);
  // Saves go one after another: an earlier one never lands on top of a later one.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const filled = Object.values(draft).every((value) => value.trim() !== "");

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
      notify.success("Review.release.done");
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        code === "PROPOSAL_RELEASED" || code === "PROPOSAL_OUTCOMES_NOT_READY"
          ? `Review.errors.${code}`
          : "Review.errors.unknown",
      );
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
        <FieldLabel htmlFor={`${key}-message`}>{t("message")}</FieldLabel>
        <Textarea
          id={`${key}-message`}
          rows={10}
          value={draft[`${key}Message`]}
          maxLength={5000}
          readOnly={released}
          onChange={(event) => write({ ...draft, [`${key}Message`]: event.target.value })}
        />
        <FieldDescription>{t("placeholders")}</FieldDescription>
      </Field>
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
                      time: format.dateTime(savedAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hourCycle: "h23",
                      }),
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
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={checked}
              disabled={!ready}
              onCheckedChange={(value) => setChecked(Boolean(value))}
            />
            <span>{t("checked")}</span>
          </label>
          <Button pending={pending} disabled={!ready || !checked || !filled} onClick={release}>
            {ready
              ? t("release", { count: counts.shortlisted + counts.notSelected })
              : (blocked ?? t("notReady"))}
          </Button>
        </section>
      )}
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
