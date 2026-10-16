"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useNotify } from "@/hooks/use-notify";
import { decideApplications } from "@/lib/api/generated";

type Decision = "under_review" | "shortlisted" | "not_selected";

type DecisionPanelProps = {
  programId: string;
  applicationId: string;
  decision: Decision;
  released: boolean;
};

/**
 * GenAI Fund's decision on an application, with a private reason. The page stays on the
 * application, which shows the decision made; a decision changes until the outcomes are released,
 * and each change is kept.
 */
function DecisionPanel({ programId, applicationId, decision, released }: DecisionPanelProps) {
  const t = useTranslations("Review.decision");
  const notify = useNotify();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);
  const undecided = decision === "under_review";

  async function decide(to: "shortlisted" | "not_selected") {
    setPending(to);
    try {
      await decideApplications({
        path: { programId },
        body: {
          applicationIds: [applicationId],
          decision: to,
          reason: reason.trim() === "" ? null : reason,
        },
      });
      notify.success(`Review.decision.done.${to}`);
      setReason("");
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="decision-title"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="decision-title" className="text-base font-semibold">
          {t("title")}
        </h2>
        {!undecided && (
          <Badge variant={decision === "shortlisted" ? "success" : "outline"}>
            {t(`state.${decision}`)}
          </Badge>
        )}
      </div>
      {released ? (
        <p className="text-sm text-muted-foreground">{t("released")}</p>
      ) : (
        <>
          <Field>
            <FieldLabel htmlFor="decision-reason">
              {undecided ? t("reason") : t("changeReason")}
            </FieldLabel>
            <Textarea
              id="decision-reason"
              value={reason}
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            {decision !== "shortlisted" && (
              <Button
                pending={pending === "shortlisted"}
                disabled={pending !== null}
                onClick={() => decide("shortlisted")}
              >
                {undecided ? t("shortlist") : t("changeToShortlisted")}
              </Button>
            )}
            {decision !== "not_selected" && (
              <Button
                prominence="secondary"
                pending={pending === "not_selected"}
                disabled={pending !== null}
                onClick={() => decide("not_selected")}
              >
                {undecided ? t("notSelected") : t("changeToNotSelected")}
              </Button>
            )}
          </div>
          <FieldDescription>{t("private")}</FieldDescription>
        </>
      )}
    </section>
  );
}

export { DecisionPanel };
