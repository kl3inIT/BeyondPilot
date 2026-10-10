import { CircleCheckIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import type { MyUseCase } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PostUseCase } from "./post-use-case";
import { LiveRefresh } from "./live-refresh";

/** What the people of the organization see once they have sent a use case: what was sent and what happens next. */
function UseCaseSentPage({ useCase }: { useCase: MyUseCase }) {
  const t = useTranslations("Organization.useCases.sent");
  const status = useTranslations("Organization.useCases.status");
  const format = useFormatter();
  const when = (instant: string | null | undefined) =>
    instant
      ? `${format.dateTime(new Date(instant), {
          dateStyle: "medium",
          timeZone: "Asia/Ho_Chi_Minh",
        })}, ${format.dateTime(new Date(instant), {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Ho_Chi_Minh",
        })} ICT`
      : "";

  const rows: { key: "useCase" | "organization" | "status" | "sent" | "closes"; value: string }[] =
    [
      { key: "useCase", value: useCase.title ?? "" },
      { key: "organization", value: useCase.organizationName },
      { key: "status", value: status(useCase.status) },
      { key: "sent", value: when(useCase.submittedAt) },
      { key: "closes", value: when(useCase.closesAt) },
    ];
  const next = ["review", "hearBack", "published"] as const;

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 py-10 md:py-16">
      <LiveRefresh />
      <div className="flex w-full max-w-2xl flex-col gap-8 rounded-3xl border bg-background p-6 md:p-10">
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
          <CircleCheckIcon className="size-8 text-success" aria-hidden="true" />
          {t("title")}
        </h1>

        <dl className="flex flex-col divide-y border-y text-sm">
          {rows.map((row) => (
            <div key={row.key} className="grid gap-1 py-3 sm:grid-cols-3">
              <dt className="text-muted-foreground">{t(`rows.${row.key}`)}</dt>
              <dd className="sm:col-span-2">{row.value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="next" className="flex flex-col gap-4">
          <h2 id="next" className="text-base font-medium">
            {t("next.title")}
          </h2>
          <ol className="flex flex-col gap-4">
            {next.map((name, index) => (
              <li key={name} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-primary text-xs font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{t(`next.${name}.title`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`next.${name}.meta`)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="flex flex-wrap gap-3">
          <Button href={siteRoutes.workspaceUseCases}>{t("viewMine")}</Button>
          <PostUseCase prominence="secondary" another />
        </div>
      </div>
    </div>
  );
}

export { UseCaseSentPage };
