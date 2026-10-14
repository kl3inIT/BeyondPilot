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
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { DataTableRows } from "@/components/composites/data-table-view";
import { HelpPopover } from "@/components/composites/help-popover";
import { StatCell, StatStrip } from "@/components/composites/stat-cell";
import { Status } from "@/components/composites/status";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { getFormatter } from "@/i18n/format-server";
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
  const time = (value: string) => format.dateTime(new Date(value), "time");
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

  // When the index repairs itself: beside each Rebuild button, for the few who ask.
  const rebuildHelp = (
    <HelpPopover label={t("repair.help")}>
      <p>{t("repair.never")}</p>
    </HelpPopover>
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <AdminPageHeader
        destination="searchIndex"
        title={t("title")}
        actions={
          <div className="hidden items-center gap-1 md:flex">
            {rebuildHelp}
            <RebuildIndex />
          </div>
        }
      />

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

      <StatStrip columns={4}>
        {stats.map((stat) => (
          <StatCell
            key={stat.label}
            label={stat.label}
            value={stat.value}
            alert={stat.alert}
            icon={
              stat.alert && (
                <TriangleAlertIcon className="size-4 text-destructive" aria-hidden="true" />
              )
            }
          >
            {stat.note}
          </StatCell>
        ))}
      </StatStrip>

      <section aria-labelledby="by-kind" className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1">
          <h2 id="by-kind" className="text-base font-medium">
            {t("kinds.heading")}
          </h2>
          <HelpPopover label={t("kinds.noteHelp")}>
            <p>{t("kinds.note")}</p>
          </HelpPopover>
        </div>
        <DataTableRows
          columns={[
            { id: "kind", header: t("kinds.kind") },
            { id: "total", header: t("kinds.total"), layout: { numeric: true } },
            { id: "listed", header: t("kinds.listed"), layout: { numeric: true } },
            { id: "embedded", header: t("kinds.embedded"), layout: { numeric: true } },
            { id: "waiting", header: t("kinds.waiting"), layout: { numeric: true } },
            { id: "heldBack", header: t("kinds.heldBack"), layout: { numeric: true } },
          ]}
          rows={kinds.map((kind) => ({
            id: kind.kind,
            cells: {
              kind: (
                <span className="flex items-center gap-2 font-medium">
                  {kindIcons[kind.kind]}
                  {t(`kinds.name.${kind.kind}`)}
                </span>
              ),
              total: format.number(kind.total),
              listed: format.number(kind.listed),
              embedded:
                kind.total === 0
                  ? "0"
                  : t("kinds.embeddedShare", {
                      count: kind.embedded,
                      share: format.number(kind.embedded / kind.total, { style: "percent" }),
                    }),
              waiting: (
                <span className={kind.waiting === 0 ? "text-muted-foreground" : undefined}>
                  {format.number(kind.waiting)}
                </span>
              ),
              heldBack:
                kind.heldBack > 0 ? (
                  <Status tone="destructive">{format.number(kind.heldBack)}</Status>
                ) : (
                  <span className="text-muted-foreground">0</span>
                ),
            },
          }))}
        />
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
          <DataTableRows
            columns={[
              { id: "item", header: t("heldBack.item") },
              { id: "reason", header: t("heldBack.reason") },
              { id: "attempts", header: t("heldBack.attempts") },
              { id: "next", header: t("heldBack.next") },
              { id: "actions", header: <span className="sr-only">{t("heldBack.actions")}</span> },
            ]}
            rows={data.heldBack.map((item) => ({
              id: `${item.kind}-${item.itemId}`,
              cells: {
                item: (
                  <div className="flex flex-col">
                    <span className="font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {t(`kinds.name.${item.kind}`)}
                    </span>
                  </div>
                ),
                reason: (
                  <span className="block min-w-48 whitespace-normal">
                    {t(`heldBack.reasons.${item.reason}`)}
                  </span>
                ),
                attempts: item.attempts,
                next: (
                  <span className="text-muted-foreground">
                    {item.nextAttemptAt ? dayAndTime(item.nextAttemptAt) : t("heldBack.soon")}
                  </span>
                ),
                actions: (
                  <div className="flex justify-end">
                    <RetryEmbeddings item={item} />
                  </div>
                ),
              },
            }))}
          />
          <div className="md:hidden">
            <RetryEmbeddings wide />
          </div>
        </section>
      )}

      {data.lastRebuild && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <HistoryIcon className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {t("repair.last", {
            when: dayAndTime(data.lastRebuild.at),
            saved: data.lastRebuild.saved,
            removed: data.lastRebuild.removed,
          })}
        </p>
      )}
      <div className="flex items-center gap-1 md:hidden">
        <div className="flex-1">
          <RebuildIndex wide />
        </div>
        {rebuildHelp}
      </div>
    </div>
  );
}

export { SearchIndexPage };
