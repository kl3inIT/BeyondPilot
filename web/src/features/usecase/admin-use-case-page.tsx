import { CheckIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminUseCase } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

import { AdminUseCaseDecision } from "./admin-use-case-decision";
import { AdminUseCaseReview } from "./admin-use-case-review";
import { LiveRefresh } from "./live-refresh";

type AdminUseCasePageProps = {
  useCase: AdminUseCase;
};

/**
 * Admin › a use case: where it stands, what it says and what became of it. The use case is read the way its
 * members wrote it, step by step, and never edited here. One in review carries the operators' decision beside it.
 */
function AdminUseCasePage({ useCase }: AdminUseCasePageProps) {
  const t = useTranslations("Admin.useCases.detail");
  const d = useTranslations("Admin.useCases.decision");
  const format = useFormatter();
  const locale = useLocale();

  const organization = useCase.organization.name;
  const title = useCase.title ?? t("untitled");
  const status = useCase.status;
  const when = (instant: string) =>
    `${format.dateTime(new Date(instant), {
      dateStyle: "medium",
      timeZone: "Asia/Ho_Chi_Minh",
    })}, ${format.dateTime(new Date(instant), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    })} ICT`;
  const day = (instant: string) =>
    format.dateTime(new Date(instant), { dateStyle: "medium", timeZone: "Asia/Ho_Chi_Minh" });
  const closes = useCase.closesAt ? when(useCase.closesAt) : "";

  /** What happened to the use case, oldest first, and where it waits now. */
  const history: { key: string; title: string; meta: string; current?: boolean }[] = [
    {
      key: "created",
      title: t("history.created", { name: useCase.createdBy.name }),
      meta: t("history.createdMeta", { date: day(useCase.createdAt), organization }),
    },
  ];
  if (useCase.submittedAt && useCase.submittedBy) {
    history.push({
      key: "sent",
      title: t("history.sent"),
      meta: t("history.by", { date: when(useCase.submittedAt), name: useCase.submittedBy.name }),
    });
  }
  if (status === "needs_changes" && useCase.reviewedAt && useCase.reviewedBy) {
    history.push({
      key: "sentBack",
      title: t("history.sentBack"),
      meta: t("history.sentBackMeta", {
        date: when(useCase.reviewedAt),
        name: useCase.reviewedBy.name,
        note: useCase.reviewNote ?? "",
      }),
    });
  }
  if (useCase.publishedAt) {
    const by = useCase.reviewedBy ?? useCase.createdBy;
    history.push({
      key: "published",
      title: t("history.published"),
      meta: t("history.by", { date: when(useCase.publishedAt), name: by.name }),
    });
  }
  if (status === "closed") {
    history.push({
      key: "closed",
      title: t("history.closed"),
      meta: t("history.closedMeta", { date: closes }),
      current: true,
    });
  } else if (status === "approved") {
    history[history.length - 1].current = true;
  } else {
    history.push({
      key: status,
      title: t(`history.now.${status}.title`),
      meta: t(`history.now.${status}.meta`, { organization }),
      current: true,
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <LiveRefresh />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{t(`subtitle.${status}`, { organization })}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <AdminUseCaseReview useCase={useCase} />
        </div>

        {/* The decision and the history stay in view while the use case is read. */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          {(status === "in_review" || status === "approved") && (
            <Card size="lg">
              <CardHeader>
                <CardTitle>{d("title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4">
                  <p className="text-sm text-muted-foreground">
                    {d(status === "approved" ? "leadPublished" : "lead", { organization })}
                  </p>
                  <AdminUseCaseDecision
                    id={useCase.id}
                    title={title}
                    organization={organization}
                    published={status === "approved"}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <Card size="lg">
            <CardHeader>
              <CardTitle>{t("history.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col">
                {history.map((item, index) => (
                  <li key={item.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                          item.current
                            ? "border-primary text-primary"
                            : "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {item.current ? index + 1 : <CheckIcon className="size-3.5" />}
                      </span>
                      {index < history.length - 1 && (
                        <span aria-hidden="true" className="my-1 w-0.5 flex-1 bg-primary" />
                      )}
                    </div>
                    <div className="mb-5 flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{item.meta}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { AdminUseCasePage };
