"use client";

import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormatter } from "@/i18n/format";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicCustomerDeployment } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

type CustomerDeploymentCardProps = {
  deployment: PublicCustomerDeployment;
  /** Who delivered it: the organization of the solution. */
  /** Who delivered it; `slug` is null for a person on their own, who has no page. */
  organization: { name: string; slug: string | null | undefined };
};

/** Whether two texts say the same once case and spacing are set aside. */
function sameText(one: string, other: string) {
  const plain = (text: string) => text.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return plain(one) === plain(other);
}

/**
 * One customer deployment of a solution: what was deployed, for whom, and who says so, in a card,
 * and the whole account in a dialog. The source stands on the card, since the record is the
 * organization's own statement that GenAI Fund reviewed, never the customer's. What the
 * organization did not publish reads as not published, in one line when it published no scope at
 * all, and what was deployed is left out when it only repeats the problem.
 */
function CustomerDeploymentCard({ deployment, organization }: CustomerDeploymentCardProps) {
  const t = useTranslations("Solution.deployment");
  const stage = useVocabulary("deploymentStage");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const scope = [
    { name: t("channels"), value: deployment.channels },
    { name: t("languages"), value: deployment.languages },
    { name: t("period"), value: deployment.period },
    { name: t("result"), value: deployment.result },
  ];
  const line = t("line", { solution: deployment.solutionName, customer: deployment.customer });
  const source = {
    organization: organization.name,
    day: format.dateTime(new Date(deployment.approvedAt), "date"),
  };
  const delivered = !sameText(deployment.delivered, deployment.problem);
  const scoped = scope.some((fact) => fact.value);
  // The foot promises only the parts the dialog holds.
  const holds =
    delivered && deployment.result
      ? "all"
      : delivered
        ? "delivered"
        : deployment.result
          ? "result"
          : "problem";

  return (
    <article className="relative flex flex-col items-start gap-2.5 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[button:focus-visible]:border-ring has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-ring/50">
      <h3 className="text-lg font-semibold">
        <button
          type="button"
          className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl"
          onClick={() => setOpen(true)}
        >
          {deployment.title}
        </button>
      </h3>
      <p className="text-sm text-muted-foreground">{line}</p>
      <div className="pt-1">
        <Badge variant="outline">{stage(deployment.stage)}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{t("source", source)}</p>
      <p className="text-xs text-muted-foreground">{t("open", { holds })}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <p className="text-xs text-muted-foreground">{t("eyebrow")}</p>
            <DialogTitle>{deployment.title}</DialogTitle>
            <DialogDescription>
              {t("lead", { stage: stage(deployment.stage), ...source })}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <div className="flex min-w-0 flex-1 flex-col gap-5">
              <section className="flex flex-col gap-1.5">
                <h4 className="text-base font-semibold">{t("problem")}</h4>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {deployment.problem}
                </p>
              </section>
              {delivered && (
                <section className="flex flex-col gap-1.5">
                  <h4 className="text-base font-semibold">{t("delivered")}</h4>
                  <p className="text-sm whitespace-pre-line text-muted-foreground">
                    {deployment.delivered}
                  </p>
                </section>
              )}
              <section className="flex flex-col gap-2">
                <h4 className="text-base font-semibold">{t("scope")}</h4>
                {scoped ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {scope.map((fact) => (
                      <div
                        key={fact.name}
                        className="flex flex-col gap-0.5 rounded-xl bg-muted p-3"
                      >
                        <dt className="text-xs text-muted-foreground">{fact.name}</dt>
                        {fact.value ? (
                          <dd className="text-sm font-medium">{fact.value}</dd>
                        ) : (
                          <dd className="text-sm font-medium text-muted-foreground">
                            {t("notPublished")}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("scopeNone", { organization: organization.name })}
                  </p>
                )}
              </section>
            </div>
            <aside className="flex flex-col gap-3 rounded-2xl border bg-card p-4 md:w-60 md:shrink-0">
              <h4 className="text-sm font-medium">{t("about")}</h4>
              <dl className="flex flex-col gap-3">
                <div className="flex flex-col items-start gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("deliveredBy")}</dt>
                  <dd>
                    {organization.slug ? (
                      <TextButton
                        size="sm"
                        href={`${siteRoutes.organizations}/${organization.slug}`}
                      >
                        {organization.name}
                        <ArrowRightIcon aria-hidden="true" />
                      </TextButton>
                    ) : (
                      <span className="text-sm">{organization.name}</span>
                    )}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("customer")}</dt>
                  <dd className="text-sm font-medium">{deployment.customer}</dd>
                </div>
                <div className="flex flex-col items-start gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("solutionUsed")}</dt>
                  <dd className="w-full min-w-0">
                    <TextButton
                      size="sm"
                      href={`${siteRoutes.solutions}/${deployment.solutionSlug}`}
                      className="max-w-full"
                    >
                      <span className="truncate">{deployment.solutionName}</span>
                      <ArrowRightIcon aria-hidden="true" />
                    </TextButton>
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

export { CustomerDeploymentCard };
