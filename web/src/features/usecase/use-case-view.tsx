"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { moveMyUseCaseToDraft, type MyUseCase } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { describeUseCaseError } from "./my-use-case-errors";
import { draftValuesOf } from "./use-case-draft";
import { UseCaseSummary } from "./use-case-summary";
import { UseCaseTabs } from "./use-case-tabs";
import { WizardShell } from "./wizard-shell";
import { LiveRefresh } from "./live-refresh";

/**
 * A use case the members cannot change now, laid out as it was written: one that waits for GenAI Fund,
 * which they can take back to a draft, or one whose deadline has passed, which nobody can change.
 */
function UseCaseView({ useCase }: { useCase: MyUseCase }) {
  const t = useTranslations("Organization.useCases.view");
  const w = useTranslations("Organization.useCases.wizard");
  const notify = useNotify();
  const router = useRouter();
  const format = useFormatter();
  const [pending, setPending] = useState(false);
  const values = draftValuesOf(useCase);
  const inReview = useCase.status === "in_review";

  async function pullBack() {
    setPending(true);
    try {
      await moveMyUseCaseToDraft({ path: { id: useCase.id } });
      notify.success("Organization.useCases.done.draft", {
        name: useCase.title ?? w("untitled"),
      });
      // The use case is a draft now: the same address opens it for editing.
      router.refresh();
    } catch (error) {
      notify.error(describeUseCaseError(error));
      setPending(false);
    }
  }

  const closes = useCase.closesAt
    ? format.dateTime(new Date(useCase.closesAt), {
        dateStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "";
  const sent = useCase.submittedAt
    ? format.dateTime(new Date(useCase.submittedAt), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "";

  return (
    <WizardShell
      title={values.title.trim() || w("untitled")}
      organizationName={useCase.organizationName}
      exit={<TextButton href={siteRoutes.workspaceUseCases}>{w("backToList")}</TextButton>}
      current="review"
      done={(step) => step !== "review"}
      notes={[inReview ? t("inReview.note") : t("closed.note")]}
    >
      <LiveRefresh />
      {useCase.publishedAt && <UseCaseTabs area="workspace" id={useCase.id} current="brief" />}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {inReview ? t("inReview.title") : t("closed.title")}
        </h1>
        <p className="text-base text-muted-foreground">
          {inReview ? t("inReview.lead", { date: sent }) : t("closed.lead", { date: closes })}
        </p>
      </div>
      <UseCaseSummary values={values} hideEmpty={useCase.status === "approved"} />
      <div className="flex items-center justify-between gap-3 border-t pt-6">
        <Button prominence="tertiary" href={siteRoutes.workspaceUseCases}>
          {w("backToList")}
        </Button>
        {inReview && (
          <Button prominence="secondary" pending={pending} onClick={() => void pullBack()}>
            {t("pullBack")}
          </Button>
        )}
      </div>
    </WizardShell>
  );
}

export { UseCaseView };
