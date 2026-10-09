"use client";

import { ChevronDownIcon, ChevronUpIcon, InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore, type ReactNode } from "react";

import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotify } from "@/hooks/use-notify";
import {
  addMatchingCandidate,
  removeMatchingCandidate,
  restoreMatchingCandidate,
  shortlistMatchingCandidate,
  startMatchingRun,
  type AdminSolutionSummary,
  type Matching,
  type MatchingCandidate,
  type RemoveMatchingCandidate,
} from "@/lib/api/generated";

import { MatchingAdd } from "./matching-add";
import { MatchingCoverage } from "./matching-coverage";
import { describeMatchingError } from "./matching-errors";
import { MatchingPanel } from "./matching-panel";
import { MatchingRemove } from "./matching-remove";
import { MatchingRemoved } from "./matching-removed";
import { MatchingRow } from "./matching-row";
import { MatchingRun } from "./matching-run";
import {
  constraintsOf,
  coverageOf,
  grouped,
  groups,
  needsOf,
  recommendedOf,
  tabsOf,
  withNeed,
} from "./matching-view";

/** How many candidates a group shows before "Show more". */
const GROUP_ROWS = 5;

/** From this width the chosen candidate is read beside the list; below it, in a sheet over it. */
const WIDE = "(min-width: 1024px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const tabNames = ["all", "shortlist", "removed"] as const;
type TabName = (typeof tabNames)[number];

type Section = (typeof groups)[number] | "waiting";

type GroupCardProps = {
  title: string;
  about: string;
  aboutLabel: string;
  count: number;
  children: ReactNode;
};

/** One group of candidates: its name, how many it holds, what the group means, and its rows. */
function GroupCard({ title, about, aboutLabel, count, children }: GroupCardProps) {
  return (
    <section className="flex flex-col gap-1 rounded-xl border bg-card px-2 py-3">
      <div className="flex items-center gap-2 px-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">{count}</span>
        <Popover>
          <PopoverTrigger
            render={<IconButton prominence="tertiary" size="sm" aria-label={aboutLabel} />}
          >
            <InfoIcon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent align="start">
            <p className="text-sm">{about}</p>
          </PopoverContent>
        </Popover>
      </div>
      {children}
    </section>
  );
}

/**
 * The candidates of a use case and what people decide on them: the run and its actions, what the
 * candidates cover together, the list by group narrowed by need and by tab, and one candidate read in
 * full beside it. Every request answers with the whole state, which the screen shows at once; a newer
 * read of the page replaces it.
 */
function MatchingBoard({ matching: read }: { matching: Matching }) {
  const t = useTranslations("Matching");
  const reasonName = useTranslations("Matching.remove.reasons");
  const notify = useNotify();
  const wide = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
  const [held, setHeld] = useState({ over: read, state: read });
  const [tab, setTab] = useState<TabName>("all");
  const [need, setNeed] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Section[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  // What a request answered stands until the page is read again.
  const matching = held.over === read ? held.state : read;
  const { useCaseId, operator } = matching;
  const needs = needsOf(matching.requirements);
  const constraints = constraintsOf(matching.requirements);
  const tabs = tabsOf(matching.candidates);
  const coverage = coverageOf(needs, matching.candidates);
  const listed = withNeed(tab === "shortlist" ? tabs.shortlist : tabs.all, need);
  const sections = grouped(listed);
  const flat = [
    ...sections.direct,
    ...sections.industry,
    ...sections.technology,
    ...sections.waiting,
  ];
  const chosen =
    tab === "removed"
      ? undefined
      : (flat.find((candidate) => candidate.id === selectedId) ?? (wide ? flat[0] : undefined));
  const place = chosen ? flat.indexOf(chosen) : -1;
  const required = needs.filter((one) => one.required).length;
  const chosenNeed = needs.find((one) => one.position === need);

  /** Sends one request; its answer is the whole state, shown at once. */
  async function send(
    key: string,
    request: () => Promise<{ data: Matching }>,
    done?: () => void,
  ): Promise<boolean> {
    setPending(key);
    try {
      const { data } = await request();
      setHeld({ over: read, state: data });
      done?.();
      return true;
    } catch (error) {
      notify.error(describeMatchingError(error));
      return false;
    } finally {
      setPending(null);
    }
  }

  const start = async (judgeAll: boolean) => {
    await send(
      judgeAll ? "judgeAll" : "run",
      () => startMatchingRun({ path: { useCaseId }, body: { judgeAll } }),
      () => notify.success(judgeAll ? "Matching.done.judgingAll" : "Matching.done.started"),
    );
  };

  const add = (solution: AdminSolutionSummary) =>
    send(
      `add:${solution.id}`,
      () => addMatchingCandidate({ path: { useCaseId }, body: { solutionId: solution.id } }),
      () => notify.success("Matching.done.added", { name: solution.name }),
    );

  const restore = (candidate: MatchingCandidate, said: "restored" | "unshortlisted") =>
    send(
      candidate.id,
      () => restoreMatchingCandidate({ path: { candidateId: candidate.id } }),
      () => notify.success(`Matching.done.${said}`, { name: candidate.solutionName }),
    );

  const shortlist = (candidate: MatchingCandidate) =>
    candidate.decision === "shortlisted"
      ? restore(candidate, "unshortlisted")
      : send(
          candidate.id,
          () => shortlistMatchingCandidate({ path: { candidateId: candidate.id } }),
          () => notify.success("Matching.done.shortlisted", { name: candidate.solutionName }),
        );

  const remove = (candidate: MatchingCandidate, body: RemoveMatchingCandidate) =>
    send(
      candidate.id,
      () => removeMatchingCandidate({ path: { candidateId: candidate.id }, body }),
      () => {
        setRemovingId(null);
        notify.success(
          "Matching.done.removed",
          { name: candidate.solutionName, reason: reasonName(body.reason) },
          { label: "Matching.done.undo", onClick: () => void restore(candidate, "restored") },
        );
      },
    );

  /** Opens the reason picker in the place of the candidate's row, wherever the person asked from. */
  function askWhy(candidate: MatchingCandidate) {
    const section: Section =
      candidate.judged && candidate.bucket !== "none" ? candidate.bucket : "waiting";
    setExpanded((current) => (current.includes(section) ? current : [...current, section]));
    setSheetOpen(false);
    setRemovingId(candidate.id);
  }

  function select(candidate: MatchingCandidate) {
    setSelectedId(candidate.id);
    setSheetOpen(true);
  }

  const rows = (section: Section) => {
    const all = sections[section];
    const open = expanded.includes(section);
    const shown = open ? all : all.slice(0, GROUP_ROWS);
    return (
      <>
        <ul className="flex flex-col">
          {shown.map((candidate) =>
            candidate.id === removingId ? (
              <li key={candidate.id} className="p-1">
                <MatchingRemove
                  candidate={candidate}
                  pending={pending === candidate.id}
                  onCancel={() => setRemovingId(null)}
                  onRemove={(body) => void remove(candidate, body)}
                />
              </li>
            ) : (
              <MatchingRow
                key={candidate.id}
                candidate={candidate}
                needs={needs}
                selected={chosen?.id === candidate.id}
                pending={pending === candidate.id}
                onSelect={() => select(candidate)}
                onShortlist={() => void shortlist(candidate)}
                onRemove={() => askWhy(candidate)}
              />
            ),
          )}
        </ul>
        {all.length > GROUP_ROWS && (
          <div className="px-3 pt-1">
            <TextButton
              aria-expanded={open}
              onClick={() =>
                setExpanded((current) =>
                  open ? current.filter((one) => one !== section) : [...current, section],
                )
              }
            >
              {open ? t("groups.fewer") : t("groups.more", { count: all.length - GROUP_ROWS })}
              {open ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
            </TextButton>
          </div>
        )}
      </>
    );
  };

  const list = (
    <div className="flex flex-col gap-4">
      {flat.length === 0 && chosenNeed && (
        <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {t("empty.need", { need: chosenNeed.name })}
          </p>
          <TextButton onClick={() => setNeed(null)}>{t("empty.clear")}</TextButton>
        </div>
      )}
      {flat.length === 0 && !chosenNeed && tab === "shortlist" && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.shortlist")}
        </p>
      )}
      {groups.map((group) => {
        const lone = group === "direct" && tab === "all" && !chosenNeed && tabs.all.length > 0;
        if (sections[group].length === 0 && !lone) {
          return null;
        }
        const title = t(`groups.${group}.title`);
        return (
          <GroupCard
            key={group}
            title={title}
            about={t(`groups.${group}.about`)}
            aboutLabel={t("groups.aboutLabel", { group: title })}
            count={sections[group].length}
          >
            {sections[group].length === 0 ? (
              <p className="px-3 py-1 text-sm text-muted-foreground">
                {t("groups.emptyDirect", { count: required })}
              </p>
            ) : (
              rows(group)
            )}
          </GroupCard>
        );
      })}
      {sections.waiting.length > 0 && (
        <GroupCard
          title={t("groups.waiting.title")}
          about={t("groups.waiting.about")}
          aboutLabel={t("groups.aboutLabel", { group: t("groups.waiting.title") })}
          count={sections.waiting.length}
        >
          {rows("waiting")}
        </GroupCard>
      )}
    </div>
  );

  const panel = chosen && (
    <MatchingPanel
      candidate={chosen}
      needs={needs}
      constraints={constraints}
      pending={pending === chosen.id}
      onPrevious={place > 0 ? () => setSelectedId(flat[place - 1].id) : undefined}
      onNext={place < flat.length - 1 ? () => setSelectedId(flat[place + 1].id) : undefined}
      onShortlist={() => void shortlist(chosen)}
      onRemove={() => askWhy(chosen)}
    />
  );

  const anything = tabs.all.length + tabs.removed.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <MatchingRun
        matching={matching}
        pending={pending === "run" || pending === "judgeAll" ? pending : null}
        onStart={start}
      >
        {operator && (
          <MatchingAdd
            candidateSolutionIds={matching.candidates.map((candidate) => candidate.solutionId)}
            pendingId={pending?.startsWith("add:") ? pending.slice(4) : null}
            disabled={pending !== null}
            onAdd={add}
          />
        )}
      </MatchingRun>

      {!anything && matching.run?.state === "done" && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.none")}
        </p>
      )}

      {anything && (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
            <MatchingCoverage
              recommended={recommendedOf(matching.candidates).length}
              coverage={coverage}
            />

            {needs.length > 0 && (
              <ToggleGroup
                aria-label={t("filter.label")}
                variant="outline"
                size="sm"
                className="w-full flex-wrap"
                value={[need === null ? "all" : String(need)]}
                onValueChange={(next) => {
                  const picked = needs.find((one) => String(one.position) === next[0]);
                  setNeed(picked ? picked.position : null);
                }}
              >
                <ToggleGroupItem value="all">
                  {t("filter.all", { count: tabs.all.length })}
                </ToggleGroupItem>
                {coverage.map((one) => (
                  <ToggleGroupItem key={one.position} value={String(one.position)}>
                    {one.name}
                    <span className="text-muted-foreground">{one.count}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}

            <Tabs
              value={tab}
              onValueChange={(next) => {
                setTab(tabNames.find((name) => name === next) ?? "all");
                setRemovingId(null);
              }}
            >
              <TabsList variant="line" aria-label={t("tabs.label")}>
                {tabNames.map((name) => (
                  <TabsTrigger key={name} value={name}>
                    {t(`tabs.${name}`)}
                    <span className="text-xs text-muted-foreground">
                      {withNeed(tabs[name], need).length}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="all">{list}</TabsContent>
              <TabsContent value="shortlist">{list}</TabsContent>
              <TabsContent value="removed">
                <MatchingRemoved
                  candidates={withNeed(tabs.removed, need)}
                  operator={operator}
                  pendingId={pending}
                  onRestore={(candidate) => void restore(candidate, "restored")}
                />
              </TabsContent>
            </Tabs>
          </div>

          {wide && tab !== "removed" && (
            <aside
              aria-label={t("panel.label")}
              className="hidden rounded-xl border bg-card p-5 lg:sticky lg:top-4 lg:block"
            >
              {panel || <p className="text-sm text-muted-foreground">{t("panel.empty")}</p>}
            </aside>
          )}
        </div>
      )}

      {!wide && (
        <Sheet open={sheetOpen && chosen !== undefined} onOpenChange={setSheetOpen}>
          <SheetContent
            aria-label={chosen?.solutionName}
            closeLabel={t("panel.close")}
            className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
          >
            <div className="flex-1 overflow-y-auto px-5 pt-12 pb-6">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export { MatchingBoard };
