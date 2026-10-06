import {
  BotIcon,
  BriefcaseBusinessIcon,
  CircleCheckIcon,
  CircleOffIcon,
  CirclePauseIcon,
  HistoryIcon,
  TriangleAlertIcon,
  TrophyIcon,
  UserRoundIcon,
} from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
import { Status } from "@/components/composites/status";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SearchIndex, SearchIndexKind } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { RebuildIndex, RetryEmbeddings, SemanticSwitch } from "./search-index-actions";

const kindIcons: Record<SearchIndexKind["kind"], React.ReactNode> = {
  program: <TrophyIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  solution: <BotIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  talent: <UserRoundIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
  use_case: <BriefcaseBusinessIcon className="size-4 text-muted-foreground" aria-hidden="true" />,
};

/** The kinds in the order the directories come in the menu. */
const kindOrder: SearchIndexKind["kind"][] = ["program", "use_case", "solution", "talent"];

/**
 * Admin › AI › Search index: what search can find by keyword, how much of it is embedded for
 * semantic search, what the provider refused, and semantic search's switch. The index repairs
 * itself at every start and every night; an operator may rebuild it now or let refused items be
 * tried again.
 */
async function SearchIndexPage({ data }: { data: SearchIndex }) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Admin.searchIndex"),
    getFormatter(),
    getLocale(),
  ]);
  const kinds = [...data.kinds].sort(
    (a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind),
  );
  const sum = (pick: (kind: SearchIndexKind) => number) =>
    kinds.reduce((total, kind) => total + pick(kind), 0);
  const total = sum((kind) => kind.total);
  const embedded = sum((kind) => kind.embedded);
  const semantic = data.semantic;
  const time = (value: string) =>
    format.dateTime(new Date(value), {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  const dayAndTime = (value: string) =>
    format.dateTime(new Date(value), {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Ho_Chi_Minh",
    });

  const banner = {
    on: {
      icon: <CircleCheckIcon className="size-4.5 shrink-0 text-success" aria-hidden="true" />,
      title: t("semantic.on.title"),
      lead: t("semantic.on.lead", {
        provider: semantic.providerName ?? "",
        model: semantic.model ?? "",
        last: semantic.lastBatchAt ? time(semantic.lastBatchAt) : t("semantic.on.noBatch"),
      }),
    },
    off: {
      icon: (
        <CircleOffIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ),
      title: t("semantic.off.title"),
      lead: t("semantic.off.lead"),
    },
    paused: {
      icon: <CirclePauseIcon className="size-4.5 shrink-0 text-warning" aria-hidden="true" />,
      title: t("semantic.paused.title", {
        until: semantic.pausedUntil ? time(semantic.pausedUntil) : "",
      }),
      lead: t(`semantic.paused.reason.${semantic.failure ?? "unreachable"}`),
    },
    no_provider: {
      icon: (
        <CircleOffIcon className="size-4.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ),
      title: t("semantic.noProvider.title"),
      lead: t("semantic.noProvider.lead"),
    },
  }[semantic.state];
  const needsProvider = semantic.state === "paused" || semantic.state === "no_provider";

  const stats = [
    {
      label: t("stats.indexed"),
      value: format.number(total),
      note: t("stats.listed", { count: sum((kind) => kind.listed) }),
    },
    {
      label: t("stats.embedded"),
      value: total === 0 ? "—" : format.number(embedded / total, { style: "percent" }),
      note: semantic.model
        ? t("stats.embeddedOf", { embedded, total, model: semantic.model })
        : t("stats.noModel"),
    },
    {
      label: t("stats.waiting"),
      value: format.number(sum((kind) => kind.waiting)),
      note: t("stats.waitingNote"),
    },
    {
      label: t("stats.heldBack"),
      value: format.number(sum((kind) => kind.heldBack)),
      note: t("stats.heldBackNote"),
      alert: sum((kind) => kind.heldBack) > 0,
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("lead")}</p>
        </div>
        <div className="hidden md:block">
          <RebuildIndex />
        </div>
      </div>

      <section
        aria-label={t("semantic.label")}
        className={`flex flex-col gap-3 rounded-lg border px-4 py-3 md:flex-row md:items-center ${
          semantic.state === "paused" ? "bg-accent" : "bg-background"
        }`}
      >
        {banner.icon}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-sm font-medium">{banner.title}</p>
          <p className="text-sm text-muted-foreground">{banner.lead}</p>
        </div>
        {needsProvider && (
          <Button prominence="secondary" size="sm" href={siteRoutes.adminAiProviders}>
            {t("semantic.openProviders")}
          </Button>
        )}
        <SemanticSwitch
          enabled={semantic.enabled}
          available={semantic.state !== "no_provider"}
          settingsVersion={data.settingsVersion}
        />
      </section>

      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-lg border px-3.5 py-3">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {stat.label}
              {stat.alert && (
                <TriangleAlertIcon className="size-3.5 text-destructive" aria-hidden="true" />
              )}
            </dt>
            <dd
              className={`text-xl font-semibold md:text-2xl ${stat.alert ? "text-destructive" : ""}`}
            >
              {stat.value}
            </dd>
            <dd className={`text-xs ${stat.alert ? "text-destructive" : "text-muted-foreground"}`}>
              {stat.note}
            </dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="by-kind" className="flex flex-col gap-2.5">
        <h2 id="by-kind" className="text-base font-medium">
          {t("kinds.heading")}
        </h2>
        <DataTable className="hidden md:block">
          <TableHeader>
            <TableRow>
              <TableHead>{t("kinds.kind")}</TableHead>
              <TableHead>{t("kinds.total")}</TableHead>
              <TableHead>{t("kinds.listed")}</TableHead>
              <TableHead>{t("kinds.embedded")}</TableHead>
              <TableHead>{t("kinds.waiting")}</TableHead>
              <TableHead>{t("kinds.heldBack")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kinds.map((kind) => (
              <TableRow key={kind.kind}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    {kindIcons[kind.kind]}
                    {t(`kinds.name.${kind.kind}`)}
                  </span>
                </TableCell>
                <TableCell>{format.number(kind.total)}</TableCell>
                <TableCell>{format.number(kind.listed)}</TableCell>
                <TableCell>
                  {kind.total === 0
                    ? "0"
                    : t("kinds.embeddedShare", {
                        count: kind.embedded,
                        share: format.number(kind.embedded / kind.total, { style: "percent" }),
                      })}
                </TableCell>
                <TableCell>
                  <span className={kind.waiting === 0 ? "text-muted-foreground" : undefined}>
                    {format.number(kind.waiting)}
                  </span>
                </TableCell>
                <TableCell>
                  {kind.heldBack > 0 ? (
                    <Status tone="destructive">{format.number(kind.heldBack)}</Status>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
        <ul className="overflow-hidden rounded-lg border md:hidden">
          {kinds.map((kind) => (
            <li key={kind.kind} className="flex flex-col gap-1.5 border-b p-3 last:border-b-0">
              <div className="flex items-center gap-2">
                {kindIcons[kind.kind]}
                <span className="flex-1 text-sm font-medium">{t(`kinds.name.${kind.kind}`)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("kinds.embeddedOf", { embedded: kind.embedded, total: kind.total })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("kinds.mobileFacts", { listed: kind.listed, waiting: kind.waiting })}
              </p>
              {kind.heldBack > 0 && (
                <Status tone="destructive">
                  {t("kinds.heldBackCount", { count: kind.heldBack })}
                </Status>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("kinds.note")}</p>
      </section>

      {data.heldBack.length > 0 && (
        <section aria-labelledby="held-back" className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="held-back" className="text-base font-medium">
                {t("heldBack.heading")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("heldBack.lead")}</p>
            </div>
            <div className="hidden md:block">
              <RetryEmbeddings />
            </div>
          </div>
          <DataTable className="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead>{t("heldBack.item")}</TableHead>
                <TableHead>{t("heldBack.reason")}</TableHead>
                <TableHead>{t("heldBack.attempts")}</TableHead>
                <TableHead>{t("heldBack.next")}</TableHead>
                <TableHead>
                  <span className="sr-only">{t("heldBack.actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.heldBack.map((item) => (
                <TableRow key={`${item.kind}-${item.itemId}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {t(`kinds.name.${item.kind}`)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="whitespace-normal">
                      {t(`heldBack.reasons.${item.reason}`)}
                    </span>
                  </TableCell>
                  <TableCell>{item.attempts}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {item.nextAttemptAt ? dayAndTime(item.nextAttemptAt) : t("heldBack.soon")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <RetryEmbeddings item={item} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
          <ul className="overflow-hidden rounded-lg border md:hidden">
            {data.heldBack.map((item) => (
              <li
                key={`${item.kind}-${item.itemId}`}
                className="flex flex-col gap-1 border-b p-3 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm font-medium">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {t(`kinds.name.${item.kind}`)}
                  </span>
                </div>
                <p className="text-xs">{t(`heldBack.reasons.${item.reason}`)}</p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {t("heldBack.mobileNext", {
                      count: item.attempts,
                      next: item.nextAttemptAt
                        ? dayAndTime(item.nextAttemptAt)
                        : t("heldBack.soon"),
                    })}
                  </p>
                  <RetryEmbeddings item={item} />
                </div>
              </li>
            ))}
          </ul>
          <div className="md:hidden">
            <RetryEmbeddings wide />
          </div>
        </section>
      )}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <HistoryIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {data.lastRebuild
          ? t("repair.last", {
              when: dayAndTime(data.lastRebuild.at),
              saved: data.lastRebuild.saved,
              removed: data.lastRebuild.removed,
            })
          : t("repair.never")}
      </p>
      <div className="md:hidden">
        <RebuildIndex wide />
      </div>
    </div>
  );
}

export { SearchIndexPage };
