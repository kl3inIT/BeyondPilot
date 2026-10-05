"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ReasonDialog } from "@/components/composites/reason-dialog";
import { ReviewStatus } from "@/components/composites/review-status";
import { useNotify } from "@/hooks/use-notify";
import { useVocabulary } from "@/i18n/vocabulary";
import {
  approveCustomerDeployment,
  rejectCustomerDeployment,
  type CustomerDeployment,
  type RejectCustomerDeployment,
} from "@/lib/api/generated";

import { deploymentRejections } from "./solution-codes";
import { solutionError } from "./solution-errors";

/**
 * The customer deployments of a solution as an operator reviews them: what its organization claims
 * about each customer, and the decision. One that waits is approved or sent back with a reason; an
 * approved one can be taken off the solution's page.
 */
function CustomerDeploymentsReview({ deployments }: { deployments: CustomerDeployment[] }) {
  const t = useTranslations("Admin.solutions.deployments");
  const review = useTranslations("Admin.solutions.review");
  const status = useVocabulary("reviewStatus");
  const stage = useVocabulary("deploymentStage");
  const reason = useVocabulary("deploymentRejection");
  const notify = useNotify();
  const router = useRouter();
  const [rejecting, setRejecting] = useState<CustomerDeployment | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function decide(
    deployment: CustomerDeployment,
    done: "approved" | "rejected",
    run: () => Promise<unknown>,
  ) {
    setPending(deployment.id);
    try {
      await run();
      notify.success(
        done === "approved"
          ? "Solution.done.deploymentApproved"
          : "Solution.done.deploymentRejected",
        { name: deployment.title },
      );
      setRejecting(null);
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(null);
    }
  }

  if (deployments.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-6">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <ul className="flex flex-col gap-3">
        {deployments.map((deployment) => {
          const facts = [
            { name: t("channels"), value: deployment.channels },
            { name: t("languages"), value: deployment.languages },
            { name: t("period"), value: deployment.period },
            { name: t("result"), value: deployment.result },
          ].filter((fact) => fact.value);

          return (
            <li key={deployment.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h3 className="text-base font-medium">{deployment.title}</h3>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <ReviewStatus state={deployment.status}>
                      {status(deployment.status)}
                    </ReviewStatus>
                    <span>
                      {deployment.customer} · {stage(deployment.stage)}
                    </span>
                  </p>
                </div>
                {deployment.status !== "rejected" && (
                  <div className="flex flex-wrap gap-2">
                    {deployment.status === "submitted" && (
                      <Button
                        size="sm"
                        pending={pending === deployment.id && rejecting === null}
                        disabled={pending !== null}
                        onClick={() =>
                          decide(deployment, "approved", () =>
                            approveCustomerDeployment({ path: { id: deployment.id } }),
                          )
                        }
                      >
                        {review("approve")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      prominence="secondary"
                      tone="danger"
                      disabled={pending !== null}
                      onClick={() => setRejecting(deployment)}
                    >
                      {review(deployment.status === "approved" ? "takeDown" : "reject")}
                    </Button>
                  </div>
                )}
              </div>
              <dl className="grid gap-3 text-sm md:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <dt className="font-medium">{t("problem")}</dt>
                  <dd className="whitespace-pre-line text-muted-foreground">
                    {deployment.problem}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="font-medium">{t("delivered")}</dt>
                  <dd className="whitespace-pre-line text-muted-foreground">
                    {deployment.delivered}
                  </dd>
                </div>
                {facts.map((fact) => (
                  <div key={fact.name} className="flex flex-col gap-0.5">
                    <dt className="font-medium">{fact.name}</dt>
                    <dd className="text-muted-foreground">{fact.value}</dd>
                  </div>
                ))}
              </dl>
              {deployment.status === "rejected" && (
                <p className="rounded-lg border bg-muted p-3 text-sm">
                  <span className="font-medium">
                    {t("rejected", { reason: reason(deployment.decisionReason ?? "other") })}
                  </span>
                  {deployment.decisionMessage && <> {deployment.decisionMessage}</>}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {rejecting && (
        <ReasonDialog
          open
          onOpenChange={(next) => (next ? undefined : setRejecting(null))}
          title={review(rejecting.status === "approved" ? "takeDownTitle" : "rejectTitle", {
            name: rejecting.title,
          })}
          description={t(rejecting.status === "approved" ? "takeDownLead" : "rejectLead")}
          reasonLabel={review("reason")}
          reasonPlaceholder={review("reasonPlaceholder")}
          reasons={deploymentRejections.map((value) => ({ value, label: reason(value) }))}
          messageLabel={review("message")}
          messageHint={review("messageHint")}
          confirmLabel={review(
            rejecting.status === "approved" ? "takeDownConfirm" : "rejectConfirm",
          )}
          cancelLabel={review("cancel")}
          pending={pending === rejecting.id}
          onConfirm={(chosen, message) =>
            decide(rejecting, "rejected", () =>
              rejectCustomerDeployment({
                path: { id: rejecting.id },
                body: {
                  reason: chosen as RejectCustomerDeployment["reason"],
                  message: message.trim() || null,
                },
              }),
            )
          }
        />
      )}
    </section>
  );
}

export { CustomerDeploymentsReview };
