import { ArrowRightIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { MyApplication, MyApplications } from "@/lib/api/generated";
import { myApplicationRoute, programApplyRoute, siteRoutes } from "@/lib/site";

import { renderedAt } from "@/features/program/program-format";

import { applyFormatter } from "./apply-format";
import { ApplicationTracker } from "./application-tracker";

const statusVariant = { draft: "outline", submitted: "info", withdrawn: "outline" } as const;

/**
 * My applications: one card per application, grouped by what the person can still do with it. An
 * applicant has one or two, not dozens, and comes to see where one stands.
 */
async function MyApplicationsPage({ list }: { list: MyApplications }) {
  const [t, locale] = await Promise.all([getTranslations("MyApplications"), getLocale()]);
  const format = applyFormatter(locale);
  const now = renderedAt();
  const open = (item: MyApplication) => Date.parse(item.closesAt) > now;
  const groups = [
    {
      key: "inProgress",
      items: list.items.filter((item) => open(item) && item.status === "draft"),
    },
    { key: "submitted", items: list.items.filter((item) => open(item) && item.status !== "draft") },
    { key: "past", items: list.items.filter((item) => !open(item)) },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 md:px-8 md:py-14">
      <h1 className="text-3xl font-semibold tracking-title">{t("title")}</h1>
      {list.items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6">
          <p className="font-medium">{t("none")}</p>
          <p className="text-sm text-muted-foreground">{t("noneLead")}</p>
          <Button href={siteRoutes.programs}>{t("browse")}</Button>
        </div>
      ) : (
        groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <section
              key={group.key}
              className="flex flex-col gap-3"
              aria-label={t(`groups.${group.key}`)}
            >
              <h2 className="flex items-baseline gap-2 text-sm font-medium">
                {t(`groups.${group.key}`)}
                <span className="text-muted-foreground">{group.items.length}</span>
              </h2>
              <ul className="flex flex-col gap-3">
                {group.items.map((item) => (
                  <li key={item.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <Link
                          href={myApplicationRoute(item.id)}
                          className="text-lg font-semibold outline-none hover:underline focus-visible:underline"
                        >
                          {item.programName}
                        </Link>
                        <span className="text-sm text-muted-foreground">
                          {[item.solutionName, item.organizationName].filter(Boolean).join(" · ") ||
                            t("nothingYet")}
                        </span>
                      </div>
                      {/* Once the outcomes are released, the outcome is what the application stands at. */}
                      {item.outcome ? (
                        <Badge variant={item.outcome === "shortlisted" ? "success" : "outline"}>
                          {t(`result.${item.outcome}`)}
                        </Badge>
                      ) : (
                        <Badge variant={statusVariant[item.status]}>
                          {t(`status.${item.status}`)}
                        </Badge>
                      )}
                    </div>
                    {item.status === "submitted" && <ApplicationTracker item={item} now={now} />}
                    <p className="border-t pt-3 text-sm">
                      {item.outcome
                        ? t(`resultLead.${item.outcome}`)
                        : !open(item)
                          ? t("closedOn", { when: format.moment(item.closesAt) })
                          : item.status === "draft"
                            ? t("draftUntil", { when: format.deadline(item.closesAt) })
                            : item.status === "withdrawn"
                              ? item.allowUpdatesUntilClose
                                ? t("withdrawnUntil", { when: format.deadline(item.closesAt) })
                                : t("withdrawnForGood")
                              : item.outcomesDueOn
                                ? t("hearBack", { day: format.day(item.outcomesDueOn) })
                                : t("editUntil", { when: format.deadline(item.closesAt) })}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {open(item) && (item.status === "draft" || item.allowUpdatesUntilClose) && (
                        <Button
                          prominence={item.status === "draft" ? "primary" : "secondary"}
                          href={programApplyRoute(item.programSlug)}
                        >
                          {item.status === "draft" ? t("continue") : t("edit")}
                        </Button>
                      )}
                      <Button prominence="tertiary" href={myApplicationRoute(item.id)}>
                        {t("view")}
                        <ArrowRightIcon aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
      )}
    </div>
  );
}

export { MyApplicationsPage };
