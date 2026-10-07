import { getLocale, getTranslations } from "next-intl/server";

import type { MyApplication } from "@/lib/api/generated";

import { programFormatter } from "@/features/program/program-format";

/**
 * Where a submitted application stands, as stages from left to right: submitted, screening by
 * GenAI Fund once applications close, the outcome once it is released, and the program's next key
 * date when it has one. A stage behind the application is filled; the list reads as text to a
 * screen reader.
 */
async function ApplicationTracker({ item, now }: { item: MyApplication; now: number }) {
  const [t, locale] = await Promise.all([getTranslations("MyApplications.tracker"), getLocale()]);
  const format = programFormatter(locale);
  const day = (at: string) => format.dateTime(new Date(at), { day: "numeric", month: "short" });
  const dueDay = (date: string) =>
    format.dateTime(new Date(`${date}T00:00:00+07:00`), { day: "numeric", month: "short" });

  const stages = [
    {
      key: "submitted",
      label: t("submitted"),
      detail: item.submittedAt ? day(item.submittedAt) : "",
      done: true,
    },
    {
      key: "screening",
      label: t("screening"),
      detail: t("screeningBy"),
      done: Date.parse(item.closesAt) <= now,
    },
    {
      key: "outcome",
      label: t("outcome"),
      detail: item.outcome
        ? t(`result.${item.outcome}`)
        : item.outcomesDueOn
          ? dueDay(item.outcomesDueOn)
          : t("toCome"),
      done: Boolean(item.outcome),
    },
    ...(item.next
      ? [
          {
            key: "next",
            label: item.next.title,
            detail: day(item.next.at),
            done: Date.parse(item.next.at) <= now,
          },
        ]
      : []),
  ];

  return (
    <ol aria-label={t("label")} className="grid auto-cols-fr grid-flow-col gap-1.5">
      {stages.map((stage) => (
        <li key={stage.key} className="flex min-w-0 flex-col gap-1.5">
          <span
            aria-hidden="true"
            className={stage.done ? "h-1 rounded-full bg-primary" : "h-1 rounded-full bg-border"}
          />
          <span
            className={
              stage.done
                ? "truncate text-xs font-medium text-foreground"
                : "truncate text-xs text-muted-foreground"
            }
          >
            {stage.label}
            <span className="sr-only">{stage.done ? t("done") : t("ahead")}</span>
          </span>
          <span className="truncate text-xs text-muted-foreground">{stage.detail}</span>
        </li>
      ))}
    </ol>
  );
}

export { ApplicationTracker };
