import { ArrowLeftIcon, CircleAlertIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { TextButton } from "@/components/actions/text-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { applyFormatter } from "@/features/apply/apply-format";
import type { Release, ReleaseItem } from "@/lib/api/generated";
import { adminProgramApplicationsRoute } from "@/lib/site";

import { ReleaseForm } from "./release-form";

/**
 * Admin › a program › Release outcomes: who is shortlisted and who is not, the email each group
 * gets, and the release, once applications have closed and every application has a decision.
 */
async function ReleasePage({ release }: { release: Release }) {
  const [t, vocabulary, locale] = await Promise.all([
    getTranslations("Review.release"),
    getTranslations("Vocabulary"),
    getLocale(),
  ]);
  const format = applyFormatter(locale);
  const { head } = release;
  const applications = adminProgramApplicationsRoute(head.programId);
  const words = vocabulary as unknown as { (key: string): string; has: (key: string) => boolean };
  const word = (set: "organizationType" | "country", code: string) =>
    words.has(`${set}.${code}`) ? words(`${set}.${code}`) : code;

  const blocked = head.releasedAt
    ? null
    : !head.closed
      ? t("blocked.open", { closes: format.deadline(head.closesAt) })
      : release.undecided.length > 0
        ? t("blocked.undecided", { count: release.undecided.length })
        : null;

  const groups: {
    key: string;
    title: string;
    variant: "success" | "outline" | "warning";
    items: ReleaseItem[];
  }[] = [
    ...(release.undecided.length > 0
      ? [
          {
            key: "undecided",
            title: t("groups.undecided"),
            variant: "warning" as const,
            items: release.undecided,
          },
        ]
      : []),
    {
      key: "shortlisted",
      title: t("groups.shortlisted"),
      variant: "success",
      items: release.shortlisted,
    },
    {
      key: "notSelected",
      title: t("groups.notSelected"),
      variant: "outline",
      items: release.notSelected,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <TextButton href={applications} className="self-start">
        <ArrowLeftIcon aria-hidden="true" />
        {t("back")}
      </TextButton>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead", { program: head.name })}</p>
      </div>
      {head.releasedAt ? (
        <Alert>
          <AlertTitle>{t("released", { at: format.moment(head.releasedAt) })}</AlertTitle>
        </Alert>
      ) : (
        blocked && (
          <Alert variant="destructive">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>{blocked}</AlertTitle>
            <AlertDescription>{t("blocked.why")}</AlertDescription>
          </Alert>
        )
      )}

      <div className="grid gap-6 lg:grid-cols-5 lg:items-start">
        <div className="flex flex-col gap-4 lg:col-span-3">
          {groups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`group-${group.key}`}
              className="overflow-hidden rounded-lg border bg-card"
            >
              <div className="flex items-center gap-3 bg-muted px-4 py-3">
                <Badge variant={group.variant}>{group.title}</Badge>
                <h2 id={`group-${group.key}`} className="text-sm text-muted-foreground">
                  {t("count", { count: group.items.length })}
                </h2>
              </div>
              {group.items.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">{t("emptyGroup")}</p>
              ) : (
                <ul className="divide-y">
                  {group.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <span className="flex min-w-0 flex-col">
                        <Link
                          href={`${applications}/${item.id}`}
                          className="truncate font-medium outline-none hover:underline focus-visible:underline"
                        >
                          {item.solutionName}
                        </Link>
                        <span className="truncate text-muted-foreground">
                          {[
                            item.organizationName,
                            word("organizationType", item.organizationType),
                            item.country && word("country", item.country),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {item.average == null
                          ? t("notScored")
                          : t("average", { value: item.average.toFixed(1) })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
          {release.withdrawn > 0 && (
            <p className="text-sm text-muted-foreground">
              {t("withdrawn", { count: release.withdrawn })}
            </p>
          )}
        </div>
        <div className="lg:sticky lg:top-4 lg:col-span-2">
          <ReleaseForm
            programId={head.programId}
            emails={release.emails}
            counts={{
              shortlisted: release.shortlisted.length,
              notSelected: release.notSelected.length,
            }}
            ready={release.ready}
            blocked={blocked}
            released={Boolean(head.releasedAt)}
          />
        </div>
      </div>
    </div>
  );
}

export { ReleasePage };
