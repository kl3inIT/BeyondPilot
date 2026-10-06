"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import { releaseOutcomes, type ReleaseEmails } from "@/lib/api/generated";

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
 * The email each group gets, written by the operator, and the release itself. Releasing asks the
 * operator to say they checked both lists: an email cannot be taken back.
 */
function ReleaseForm({ programId, emails, counts, ready, blocked, released }: ReleaseFormProps) {
  const t = useTranslations("Review.release");
  const notify = useNotify();
  const router = useRouter();
  const [draft, setDraft] = useState(emails);
  const [checked, setChecked] = useState(false);
  const [pending, setPending] = useState(false);
  const filled = Object.values(draft).every((value) => value.trim() !== "");

  async function release() {
    setPending(true);
    try {
      await releaseOutcomes({ path: { programId }, body: draft });
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
          onChange={(event) => setDraft({ ...draft, [`${key}Subject`]: event.target.value })}
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
          onChange={(event) => setDraft({ ...draft, [`${key}Message`]: event.target.value })}
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
        <h2 id="release-emails" className="text-base font-semibold">
          {released ? t("sentTitle") : t("emailsTitle")}
        </h2>
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
    </div>
  );
}

export { ReleaseForm };
