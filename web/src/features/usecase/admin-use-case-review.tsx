"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@/components/actions/button";
import { ReviewStatus } from "@/components/composites/review-status";
import type { AdminUseCase } from "@/lib/api/generated";

import { draftValuesOf, steps, type Step } from "./use-case-draft";
import { UseCaseStepFields } from "./use-case-step-fields";
import { UseCaseSummary } from "./use-case-summary";

/** The steps that hold fields, in the order the members wrote them. */
const fieldSteps = steps.filter((step) => step !== "review");

type View = "review" | (typeof fieldSteps)[number];

/**
 * What an operator reads of a use case: a summary of its four sections, and from each section the step as
 * the members wrote it, with Back and Continue to go through them. It is read only: operators decide on a
 * use case, they do not edit it.
 */
function AdminUseCaseReview({ useCase }: { useCase: AdminUseCase }) {
  const t = useTranslations("Admin.useCases.detail");
  const list = useTranslations("Admin.useCases");
  const w = useTranslations("Organization.useCases.wizard");
  const values = useMemo(() => draftValuesOf(useCase), [useCase]);
  const [view, setView] = useState<View>("review");
  const organization = useCase.organization.name;
  const status = (
    <ReviewStatus state={useCase.status}>{list(`status.${useCase.status}`)}</ReviewStatus>
  );

  function go(step: Step) {
    setView(step === "review" ? "review" : step);
    window.scrollTo({ top: 0 });
  }

  if (view === "review") {
    return (
      <div className="flex flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">{t("review.title")}</h2>
            {(useCase.status === "in_review" || useCase.status === "approved") && (
              <p className="text-base text-muted-foreground">
                {t("review.lead", { organization })}
              </p>
            )}
          </div>
          {status}
        </div>
        <UseCaseSummary
          values={values}
          onEdit={go}
          viewLabel={t("viewDetails")}
          hideEmpty={useCase.status === "approved"}
        />
      </div>
    );
  }

  const index = fieldSteps.indexOf(view);
  const previous = index === 0 ? "review" : fieldSteps[index - 1];
  const next = index === fieldSteps.length - 1 ? "review" : fieldSteps[index + 1];

  return (
    <div className="flex flex-col gap-5 rounded-3xl border bg-background p-6 md:p-10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-tight">{w(`steps.${view}.title`)}</h2>
          {(view === "challenge" || view === "requirements") && (
            <p className="text-base text-muted-foreground">{w(`steps.${view}.lead`)}</p>
          )}
          <p className="text-sm text-muted-foreground">{t("readOnly", { organization })}</p>
        </div>
        {status}
      </div>
      <UseCaseStepFields step={view} values={values} onChange={() => undefined} readOnly />
      <div className="flex items-center justify-between gap-3 border-t pt-6">
        <Button prominence="tertiary" onClick={() => go(previous)}>
          {previous === "review" ? t("backToReview") : w("back")}
        </Button>
        <Button onClick={() => go(next)}>{w("continue")}</Button>
      </div>
    </div>
  );
}

export { AdminUseCaseReview };
