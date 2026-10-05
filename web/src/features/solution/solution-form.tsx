"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ChoiceChips } from "@/components/composites/choice-chips";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { LeaveGuard } from "@/components/composites/leave-guard";
import { ReviewReadiness } from "@/components/composites/review-readiness";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { getPathname } from "@/i18n/navigation";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  deleteSolutionDraft,
  saveSolution,
  submitSolution,
  type SaveSolution,
  type Solution,
} from "@/lib/api/generated";
import { rejectedFields } from "@/lib/api/rejected-fields";
import { focusField } from "@/lib/focus-field";
import { siteRoutes } from "@/lib/site";

import { deployments, focusAreas, industries, maturities } from "./solution-codes";
import { solutionError } from "./solution-errors";

/** How many focus areas and industries a solution names; more would stop meaning anything. */
const MAX_CHOICES = 5;

/** The fields a review needs, in the order of the form, each with the id of its control. */
const reviewFields = [
  { field: "summary", id: "solution-summary" },
  { field: "focusAreas", id: "solution-focus-areas" },
  { field: "industries", id: "solution-industries" },
  { field: "maturity", id: "solution-maturity" },
] as const;

/** What the form holds for a solution as it was last saved. */
function saved(solution: Solution) {
  return {
    text: {
      name: solution.name,
      summary: solution.summary ?? "",
      problemsSolved: solution.problemsSolved ?? "",
      valueProposition: solution.valueProposition ?? "",
      website: solution.website ?? "",
    },
    chosen: {
      focusAreas: solution.focusAreas,
      industries: solution.industries,
      deployment: solution.deployment,
    },
    stage: (solution.maturity ?? "") as string,
    listed: solution.listed,
  };
}

/**
 * The editor of a solution. Saving keeps it as it is; sending it for review saves first, then asks
 * for the review, and is offered for a draft or a rejected solution. A change to an approved
 * solution shows in the directory at once. What a review needs is listed above the buttons from the
 * start, and a refused attempt moves to the first field it lacks.
 */
function SolutionForm({ solution }: { solution: Solution }) {
  const t = useTranslations("Solution.form");
  const focusArea = useVocabulary("focusArea");
  const industry = useVocabulary("industry");
  const maturity = useVocabulary("maturity");
  const deployment = useVocabulary("deployment");
  const locale = useLocale();
  const notify = useNotify();
  const router = useRouter();
  const initial = saved(solution);
  const [text, setText] = useState(initial.text);
  const [chosen, setChosen] = useState(initial.chosen);
  const [stage, setStage] = useState(initial.stage);
  const [listed, setListed] = useState(initial.listed);
  const [pending, setPending] = useState<"save" | "submit" | "delete" | null>(null);
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [discarding, setDiscarding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const submittable = solution.status === "draft" || solution.status === "rejected";
  const dirty =
    pending === null && JSON.stringify({ text, chosen, stage, listed }) !== JSON.stringify(initial);

  /** A field that changes is no longer marked: its message was about what it held before. */
  const settle = (field: string) =>
    setInvalid((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  const write =
    (field: keyof typeof text) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setText((current) => ({ ...current, [field]: event.target.value }));
      settle(field);
    };
  const choose = (field: keyof typeof chosen) => (value: string[]) => {
    setChosen((current) => ({ ...current, [field]: value }));
    settle(field);
  };
  const bad = (field: string) => invalid.has(field) || undefined;

  function discard() {
    setText(initial.text);
    setChosen(initial.chosen);
    setStage(initial.stage);
    setListed(initial.listed);
    setInvalid(new Set());
    setDiscarding(false);
  }

  /** What a review needs and the form does not hold yet; the backend checks the same. */
  function missingForReview() {
    const missing = new Set<string>();
    if (!text.summary.trim()) {
      missing.add("summary");
    }
    if (!stage) {
      missing.add("maturity");
    }
    if (chosen.focusAreas.length === 0) {
      missing.add("focusAreas");
    }
    if (chosen.industries.length === 0) {
      missing.add("industries");
    }
    return missing;
  }

  async function save(thenSubmit: boolean) {
    const missing = new Set<string>(text.name.trim() ? [] : ["name"]);
    // A solution that is under review or published keeps what a review needs.
    if (thenSubmit || !submittable) {
      missingForReview().forEach((field) => missing.add(field));
    }
    setInvalid(missing);
    if (missing.size > 0) {
      focusField(
        missing.has("name")
          ? "solution-name"
          : (reviewFields.find((entry) => missing.has(entry.field))?.id ?? "solution-name"),
      );
      notify.error(
        missing.has("name")
          ? "Solution.errors.REQUEST_INVALID"
          : "Solution.errors.SOLUTION_INCOMPLETE",
      );
      return;
    }
    setPending(thenSubmit ? "submit" : "save");
    try {
      await saveSolution({
        path: { id: solution.id },
        body: {
          name: text.name,
          summary: text.summary.trim() || null,
          problemsSolved: text.problemsSolved.trim() || null,
          valueProposition: text.valueProposition.trim() || null,
          website: text.website.trim() || null,
          focusAreas: chosen.focusAreas,
          industries: chosen.industries,
          deployment: chosen.deployment,
          maturity: (stage || undefined) as SaveSolution["maturity"],
          listed,
          version: solution.version,
        },
      });
      if (thenSubmit) {
        await submitSolution({ path: { id: solution.id } });
      }
      notify.success(thenSubmit ? "Solution.done.submitted" : "Solution.done.saved");
      router.refresh();
    } catch (error) {
      setInvalid(rejectedFields(error));
      notify.error(solutionError(error));
      // The save may have gone through before the submission was refused; the page shows which.
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("delete");
    try {
      await deleteSolutionDraft({ path: { id: solution.id } });
      notify.success("Solution.done.deleted", { name: solution.name });
      router.push(getPathname({ href: siteRoutes.workspaceSolutions, locale }));
    } catch (error) {
      notify.error(solutionError(error));
      setPending(null);
      setDeleting(false);
    }
  }

  const needed = (field: (typeof reviewFields)[number]["field"]) =>
    bad(field) && (
      <FieldError id={`${reviewFields.find((entry) => entry.field === field)?.id}-error`}>
        {t(`needed.${field}`)}
      </FieldError>
    );
  /** The hint and the error of a field, for the control they describe. */
  const about = (id: string) => `${id}-hint ${id}-error`;
  const lacking = missingForReview();
  /** What is still to add before a review, in the order of the form. */
  const toAdd = [
    ...(text.name.trim() ? [] : [{ id: "solution-name", label: t("name") }]),
    ...reviewFields
      .filter((entry) => lacking.has(entry.field))
      .map((entry) => ({ id: entry.id, label: t(entry.field) })),
  ];

  return (
    <form
      noValidate
      className="flex max-w-3xl flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
    >
      <FieldGroup>
        <Field data-invalid={bad("name")}>
          <FieldLabel htmlFor="solution-name">
            {t("name")}{" "}
            <span className="font-normal text-muted-foreground">{t("requiredMark")}</span>
          </FieldLabel>
          <Input
            id="solution-name"
            maxLength={120}
            value={text.name}
            onChange={write("name")}
            aria-invalid={bad("name")}
          />
          {bad("name") && <FieldError>{t("nameRequired")}</FieldError>}
        </Field>
        <Field data-invalid={bad("summary")}>
          <FieldLabel htmlFor="solution-summary">
            {t("summary")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <Textarea
            id="solution-summary"
            aria-describedby={about("solution-summary")}
            rows={2}
            maxLength={300}
            value={text.summary}
            onChange={write("summary")}
            aria-required
            aria-invalid={bad("summary")}
          />
          {needed("summary")}
          <FieldDescription id="solution-summary-hint">{t("summaryHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="solution-problems">{t("problemsSolved")}</FieldLabel>
          <Textarea
            id="solution-problems"
            rows={5}
            maxLength={4000}
            value={text.problemsSolved}
            onChange={write("problemsSolved")}
          />
          <FieldDescription>{t("problemsSolvedHint")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="solution-value">{t("valueProposition")}</FieldLabel>
          <Textarea
            id="solution-value"
            rows={5}
            maxLength={4000}
            value={text.valueProposition}
            onChange={write("valueProposition")}
          />
          <FieldDescription>{t("valuePropositionHint")}</FieldDescription>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <Field data-invalid={bad("focusAreas")}>
          <FieldLabel>
            {t("focusAreas")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <ChoiceChips
            id="solution-focus-areas"
            aria-describedby={about("solution-focus-areas")}
            label={t("focusAreas")}
            options={focusAreas.map((value) => ({ value, label: focusArea(value) }))}
            value={chosen.focusAreas}
            onValueChange={choose("focusAreas")}
            max={MAX_CHOICES}
          />
          {needed("focusAreas")}
          <FieldDescription id="solution-focus-areas-hint">
            {t("upTo", { count: MAX_CHOICES, chosen: chosen.focusAreas.length })}
          </FieldDescription>
        </Field>
        <Field data-invalid={bad("industries")}>
          <FieldLabel>
            {t("industries")}{" "}
            <span className="font-normal text-muted-foreground">
              {t(submittable ? "neededMark" : "requiredMark")}
            </span>
          </FieldLabel>
          <ChoiceChips
            id="solution-industries"
            aria-describedby={about("solution-industries")}
            label={t("industries")}
            options={industries.map((value) => ({ value, label: industry(value) }))}
            value={chosen.industries}
            onValueChange={choose("industries")}
            max={MAX_CHOICES}
          />
          {needed("industries")}
          <FieldDescription id="solution-industries-hint">
            {t("upTo", { count: MAX_CHOICES, chosen: chosen.industries.length })}
          </FieldDescription>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={bad("maturity")}>
            <FieldLabel htmlFor="solution-maturity">
              {t("maturity")}{" "}
              <span className="font-normal text-muted-foreground">
                {t(submittable ? "neededMark" : "requiredMark")}
              </span>
            </FieldLabel>
            <NativeSelect
              id="solution-maturity"
              className="w-full"
              value={stage}
              onChange={(event) => {
                setStage(event.target.value);
                settle("maturity");
              }}
              aria-required
              aria-invalid={bad("maturity")}
            >
              <NativeSelectOption value="">{t("notStated")}</NativeSelectOption>
              {maturities.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {maturity(value)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            {needed("maturity")}
          </Field>
          <Field data-invalid={bad("website")}>
            <FieldLabel htmlFor="solution-website">{t("website")}</FieldLabel>
            <Input
              id="solution-website"
              type="url"
              inputMode="url"
              placeholder="https://"
              maxLength={300}
              value={text.website}
              onChange={write("website")}
              aria-invalid={bad("website")}
            />
            {bad("website") && <FieldError>{t("websiteInvalid")}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel>{t("deployment")}</FieldLabel>
          <ChoiceChips
            label={t("deployment")}
            options={deployments.map((value) => ({ value, label: deployment(value) }))}
            value={chosen.deployment}
            onValueChange={choose("deployment")}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="solution-listed">{t("listed")}</FieldLabel>
            <FieldDescription>
              {t(solution.status === "approved" ? "listedHintApproved" : "listedHint")}
            </FieldDescription>
          </FieldContent>
          <Switch id="solution-listed" checked={listed} onCheckedChange={setListed} />
        </Field>
      </FieldGroup>

      {submittable && (
        <ReviewReadiness
          missingTitle={t("readiness.missing")}
          readyTitle={t("readiness.ready")}
          note={t("readiness.note")}
          missing={toAdd}
          refused={invalid.has("name") || reviewFields.some((entry) => invalid.has(entry.field))}
        />
      )}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t bg-background py-4">
        {submittable && (
          <Button
            pending={pending === "submit"}
            disabled={pending !== null}
            onClick={() => save(true)}
          >
            {t(solution.status === "rejected" ? "resubmit" : "submit")}
          </Button>
        )}
        <Button
          type="submit"
          prominence={submittable ? "secondary" : "primary"}
          pending={pending === "save"}
          disabled={pending !== null || !dirty}
        >
          {t(submittable ? "saveDraft" : "save")}
        </Button>
        {submittable && toAdd.length > 0 && (
          <TextButton onClick={() => focusField(toAdd[0].id)}>
            {t("readiness.count", { count: toAdd.length })}
          </TextButton>
        )}
        {dirty && (
          <>
            <Button prominence="tertiary" onClick={() => setDiscarding(true)}>
              {t("discard")}
            </Button>
            <span className="text-sm text-muted-foreground">{t("unsaved")}</span>
          </>
        )}
        {solution.status === "draft" && (
          <Button
            prominence="tertiary"
            tone="danger"
            className="ml-auto"
            disabled={pending !== null}
            onClick={() => setDeleting(true)}
          >
            {t("delete")}
          </Button>
        )}
      </div>
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={setDeleting}
          title={t("confirmDelete.title", { name: solution.name })}
          description={t("confirmDelete.lead")}
          confirmLabel={t("confirmDelete.confirm")}
          cancelLabel={t("confirmDelete.cancel")}
          tone="danger"
          pending={pending === "delete"}
          onConfirm={remove}
        />
      )}
      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
      {discarding && (
        <ConfirmDialog
          open
          onOpenChange={setDiscarding}
          title={t("confirmDiscard.title")}
          description={t("confirmDiscard.lead")}
          confirmLabel={t("discard")}
          cancelLabel={t("confirmDiscard.cancel")}
          tone="danger"
          pending={false}
          onConfirm={discard}
        />
      )}
    </form>
  );
}

export { SolutionForm };
