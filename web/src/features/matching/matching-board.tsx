"use client";

import { ChevronDownIcon, ChevronUpIcon, CircleAlertIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
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
import { useMatchingChanges } from "./matching-changes";
import { describeMatchingError } from "./matching-errors";
import { MatchingPanel } from "./matching-panel";
import { MatchingRemove } from "./matching-remove";
import { MatchingRemoved } from "./matching-removed";
import { MatchingRow } from "./matching-row";
import { MatchingRun } from "./matching-run";
import {
  changesBetween,
  constraintsOf,
  coverageOf,
  grouped,
  groups,
  groupView,
  matchesOf,
  needsOf,
  tabsOf,
  withNeed,
  type Activity,
  type Section,
} from "./matching-view";

/** From this width the chosen solution is read beside the list; below it, in a sheet over it. */
const WIDE = "(min-width: 1280px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const tabNames = ["matches", "shortlist", "removed"] as const;
type TabName = (typeof tabNames)[number];

/** How long a row that entered a group stays marked, in milliseconds: its highlight has faded by then. */
const MARKED = 2500;

/** What the screen made of the state it last drew, to say what the next one changes. */
type Seen = {
  state: Matching;
  /** What just happened to the solutions; kept until something else happens or another run starts. */
  said: Activity | null;
  /** The rows the last change put in a group. */
  arrived: string[];
  /** The rows that entered a group a moment ago. */
  fresh: string[];
  /** The run this screen saw at work. */
  watched: string | null;
};

/** Every part of the list, in the order it is drawn. */
const sectionNames = [...groups, "waiting", "kept"] as const satisfies Section[];

type GroupCardProps = {
  title: string;
  /** What the group means, printed under its title. */
  about: string;
  count: number;
  /** Given for a group that folds: whether it is open, and what a click on its header does. */
  fold?: { open: boolean; onOpenChange: (open: boolean) => void };
  children: ReactNode;
};

/**
 * One group of solutions as a named region: its title as a heading, how many it holds, what the group
 * means in plain text, and its rows. A group that folds shows its header alone until it is opened.
 */
function GroupCard({ title, about, count, fold, children }: GroupCardProps) {
  const titleId = useId();
  const heading = (
    <span className="flex min-w-0 items-baseline gap-2 text-base font-semibold">
      <span id={titleId}>{title}</span>
      <span className="text-sm font-normal text-muted-foreground">{count}</span>
    </span>
  );

  if (!fold) {
    return (
      <section
        aria-labelledby={titleId}
        className="flex flex-col gap-2 rounded-xl border bg-card px-2 py-4"
      >
        <div className="flex flex-col gap-0.5 px-3">
          <h2>{heading}</h2>
          <p className="text-sm text-muted-foreground">{about}</p>
        </div>
        {children}
      </section>
    );
  }

  return (
    <Collapsible
      open={fold.open}
      onOpenChange={fold.onOpenChange}
      render={
        <section
          aria-labelledby={titleId}
          className="flex flex-col rounded-xl border bg-card px-2 py-2"
        />
      }
    >
      <div className="flex flex-col px-3">
        <h2>
          <CollapsibleTrigger variant="section">
            {heading}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground group-focus-visible/collapsible-section-trigger:ring-3 group-focus-visible/collapsible-section-trigger:ring-ring/50">
              <ChevronDownIcon
                aria-hidden="true"
                className="size-4 transition-transform group-aria-expanded/collapsible-section-trigger:rotate-180 motion-reduce:transition-none"
              />
            </span>
          </CollapsibleTrigger>
        </h2>
        <p className="pb-2 text-sm text-muted-foreground">{about}</p>
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 pb-2">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * The solutions matched to a use case and what people decide on them: the run and its action, one
 * sentence on what was found, the list by group under three tabs, and one solution read in full, beside
 * the list on a wide screen and in a sheet below that. Every request answers with the whole state,
 * which the screen shows at once; a newer read of the page replaces it. While the screen is open it
 * listens to what changes, a run's work and other people's decisions, and reads the state again: a
 * solution the AI has read moves from "Being read" into its group, and a line says so.
 */
function MatchingBoard({ matching: read }: { matching: Matching }) {
  const t = useTranslations("Matching");
  const reasonName = useTranslations("Matching.remove.reasons");
  const notify = useNotify();
  const filterId = useId();
  const wide = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
  const [held, setHeld] = useState({ over: read, state: read });
  const [tab, setTab] = useState<TabName>("matches");
  const [need, setNeed] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  /** Whether the folding group is open, once a person opened or closed it. */
  const [opened, setOpened] = useState<Partial<Record<Section, boolean>>>({});
  /** Whether a group shows every row, once a person asked for all of them or for fewer. */
  const [expanded, setExpanded] = useState<Partial<Record<Section, boolean>>>({});
  const [pending, setPending] = useState<string | null>(null);

  // What a request answered stands until the page is read again.
  const matching = held.over === read ? held.state : read;
  const { useCaseId, operator } = matching;
  const stream = useMatchingChanges(useCaseId, (state) => setHeld({ over: read, state }));
  const running = matching.run?.state === "running";
  // A run that waits for the AI service goes on by itself: what it has not read is still to be read.
  const reads = running || matching.run?.state === "waiting";

  const [seen, setSeen] = useState<Seen>({
    state: matching,
    said: null,
    arrived: [],
    fresh: [],
    watched: running ? (matching.run?.id ?? null) : null,
  });
  // Each new state is compared with the one drawn before it, however it came: from the stream, from a
  // request's answer or from the page read again.
  if (seen.state !== matching) {
    const same = seen.state.useCaseId === matching.useCaseId;
    const sameRun = same && seen.state.run?.id === matching.run?.id;
    const change = same
      ? changesBetween(seen.state.candidates, matching.candidates)
      : { activity: undefined, arrived: [] };
    setSeen({
      state: matching,
      said: change.activity ?? (sameRun ? seen.said : null),
      arrived: change.arrived,
      fresh: same ? [...seen.fresh, ...change.arrived] : [],
      watched: running ? (matching.run?.id ?? null) : sameRun ? seen.watched : null,
    });
  }
  // A row stops being marked once its highlight has faded, so that it does not come in again when the
  // list is drawn anew, as on another tab.
  const marks = useRef(new Set<number>());
  const { arrived } = seen;
  useEffect(() => {
    if (arrived.length === 0) {
      return;
    }
    const timers = marks.current;
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      setSeen((current) => ({
        ...current,
        fresh: current.fresh.filter((id) => !arrived.includes(id)),
      }));
    }, MARKED);
    timers.add(timer);
  }, [arrived]);
  useEffect(() => {
    const timers = marks.current;
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, []);
  // While a run works, and after one this screen watched to its end, the last group is open with every
  // row, so that the rows are seen arriving; a person can still close it.
  const atWork = running || (matching.run?.state === "done" && seen.watched === matching.run.id);
  const said = !seen.said
    ? null
    : seen.said.kind === "added"
      ? t("activity.added", {
          name: seen.said.name,
          group: t(`groups.${seen.said.group}.title`),
        })
      : t("activity.several", { read: seen.said.read, added: seen.said.added });
  const needs = needsOf(matching.requirements);
  const constraints = constraintsOf(matching.requirements);
  const tabs = tabsOf(matching.candidates);
  const coverage = coverageOf(needs, matching.candidates);
  const found = matchesOf(matching.candidates);
  // A use case that asks for one thing has nothing to filter by.
  const several = needs.length > 1;
  const chosenNeed = several ? needs.find((one) => one.position === need) : undefined;
  const position = chosenNeed ? chosenNeed.position : null;
  const sections = grouped(withNeed(tab === "shortlist" ? tabs.shortlist : tabs.matches, position));
  const total = sectionNames.reduce((sum, section) => sum + sections[section].length, 0);
  // The last group folds on the Matches tab, and only under a stronger group: alone, it is the list.
  const folds = tab === "matches" && sections.direct.length + sections.industry.length > 0;
  const views = Object.fromEntries(
    sectionNames.map((section) => [
      section,
      groupView(section, sections[section].length, {
        folds,
        opened: opened[section] ?? atWork,
        all: expanded[section] ?? atWork,
      }),
    ]),
  ) as Record<Section, ReturnType<typeof groupView>>;
  // The rows on the screen, in order: what the panel shows first, and steps through.
  const flat = sectionNames.flatMap((section) => sections[section].slice(0, views[section].shown));
  const chosen =
    tab === "removed"
      ? undefined
      : (flat.find((candidate) => candidate.id === selectedId) ?? (wide ? flat[0] : undefined));
  const place = chosen ? flat.indexOf(chosen) : -1;

  /** Sends one request; its answer is the whole state, shown at once. */
  async function send(
    key: string,
    request: () => Promise<{ data: Matching }>,
    done?: () => void,
  ): Promise<boolean> {
    setPending(key);
    try {
      const { data } = await request();
      // A read the stream asked for before this answer would show an older state.
      stream.supersede();
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
      () => notify.success(judgeAll ? "Matching.done.reviewingAll" : "Matching.done.started"),
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

  /** Opens the reason picker in the place of the solution's row, wherever the person asked from. */
  function askWhy(candidate: MatchingCandidate) {
    setSheetOpen(false);
    setRemovingId(candidate.id);
  }

  function select(candidate: MatchingCandidate) {
    setSelectedId(candidate.id);
    setSheetOpen(true);
  }

  const rows = (section: Section) => {
    const view = views[section];
    const all = expanded[section] ?? atWork;
    return (
      <>
        <ul className="flex flex-col">
          {sections[section].slice(0, view.shown).map((candidate) =>
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
                selected={chosen?.id === candidate.id && (wide || sheetOpen)}
                pending={pending === candidate.id}
                reading={
                  running && stream.reading.includes(candidate.solutionId)
                    ? "now"
                    : reads && section === "waiting"
                      ? "waiting"
                      : undefined
                }
                arrived={seen.fresh.includes(candidate.id)}
                onSelect={() => select(candidate)}
                onShortlist={() => void shortlist(candidate)}
                onRemove={() => askWhy(candidate)}
              />
            ),
          )}
        </ul>
        {view.folds && (view.more > 0 || all) && (
          <div className="px-3 pt-1">
            <TextButton
              aria-expanded={all}
              onClick={() => setExpanded((current) => ({ ...current, [section]: !all }))}
            >
              {all ? t("groups.fewer") : t("groups.more", { count: view.more })}
              {all ? <ChevronUpIcon aria-hidden="true" /> : <ChevronDownIcon aria-hidden="true" />}
            </TextButton>
          </div>
        )}
      </>
    );
  };

  const list = (
    <div className="flex flex-col gap-4">
      {total === 0 && chosenNeed && (
        <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            {t("empty.need", { need: chosenNeed.statement })}
          </p>
          <TextButton onClick={() => setNeed(null)}>{t("empty.clear")}</TextButton>
        </div>
      )}
      {total === 0 && !chosenNeed && tab === "shortlist" && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.shortlist")}
        </p>
      )}
      {sectionNames.map((section) => {
        // The first group is drawn even when it is empty, so the page says that nobody is a strong fit.
        const lone =
          section === "direct" && tab === "matches" && !chosenNeed && tabs.matches.length > 0;
        if (sections[section].length === 0 && !lone) {
          return null;
        }
        const view = views[section];
        // While a run works, what is not read yet is what the AI is reading.
        const name = section === "waiting" && reads ? "reading" : section;
        return (
          <GroupCard
            key={section}
            title={t(`groups.${name}.title`)}
            about={t(`groups.${name}.about`)}
            count={sections[section].length}
            fold={
              view.folds
                ? {
                    open: view.open,
                    onOpenChange: (next) =>
                      setOpened((current) => ({ ...current, [section]: next })),
                  }
                : undefined
            }
          >
            {sections[section].length === 0 ? (
              <p className="px-3 text-sm">{t("groups.emptyDirect")}</p>
            ) : (
              rows(section)
            )}
          </GroupCard>
        );
      })}
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

  /**
   * The list, and beside it on a wide screen the solution that is read in full. The panel stays in view
   * while the list scrolls, so it is never taller than the window: what does not fit scrolls inside it.
   */
  const listAndPanel = (
    <div className="grid items-start gap-6 xl:grid-cols-3">
      <div className="min-w-0 xl:col-span-2">{list}</div>
      {wide && (
        // The frame is the window's height with a margin above and below; the panel fills it at most.
        <div className="hidden xl:sticky xl:top-0 xl:-my-4 xl:flex xl:max-h-dvh xl:flex-col xl:py-4">
          <aside
            aria-label={t("panel.label")}
            className="min-h-0 overflow-y-auto overscroll-contain rounded-xl border bg-card p-5"
          >
            {panel || <p className="text-sm text-muted-foreground">{t("panel.empty")}</p>}
          </aside>
        </div>
      )}
    </div>
  );

  const anything = tabs.matches.length + tabs.removed.length > 0;
  const covered = coverage.filter((one) => one.best === "met").length;
  const gaps = coverage.filter((one) => one.best === "not_shown");

  return (
    <div className="flex flex-col gap-6">
      <MatchingRun
        matching={matching}
        live={stream.open}
        watched={matching.run?.id !== undefined && seen.watched === matching.run.id}
        said={said}
        pending={pending === "run" || pending === "judgeAll" ? pending : null}
        onStart={start}
        onAddByHand={() => setAdding(true)}
      />
      {operator && (
        <MatchingAdd
          open={adding}
          onOpenChange={setAdding}
          candidateSolutionIds={matching.candidates.map((candidate) => candidate.solutionId)}
          pendingId={pending?.startsWith("add:") ? pending.slice(4) : null}
          onAdd={add}
        />
      )}

      {!anything && matching.run?.state === "done" && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.none")}
        </p>
      )}

      {anything && (
        <>
          <div className="flex max-w-3xl flex-col gap-3">
            {several ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-lg font-semibold">
                  {t("summary.covered", { covered, total: needs.length })}
                </p>
                {gaps.map((one) => (
                  <p key={one.position} className="flex items-start gap-2 text-sm">
                    <CircleAlertIcon
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    {t("summary.gap", { need: one.statement })}
                  </p>
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <p className="text-lg font-semibold">{t("summary.matches", found)}</p>
                {needs.map((one) => (
                  <p key={one.position} className="text-sm wrap-break-word">
                    {t("summary.asked", { need: one.statement })}
                  </p>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground">{t("summary.ai")}</p>
          </div>

          {several && (
            <div className="flex flex-col gap-2">
              <p id={filterId} className="text-sm font-medium">
                {t("filter.label")}
              </p>
              <ToggleGroup
                aria-labelledby={filterId}
                variant="outline"
                size="sm"
                className="w-full flex-wrap"
                value={[chosenNeed ? String(chosenNeed.position) : "any"]}
                onValueChange={(next) => {
                  const picked = needs.find((one) => String(one.position) === next[0]);
                  setNeed(picked ? picked.position : null);
                }}
              >
                <ToggleGroupItem value="any" className="pointer-coarse:min-h-11">
                  {t("filter.any")}
                </ToggleGroupItem>
                {coverage.map((one) => (
                  <ToggleGroupItem
                    key={one.position}
                    value={String(one.position)}
                    className="pointer-coarse:min-h-11"
                  >
                    {one.name} <span className="text-muted-foreground">{one.count}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(next) => {
              setTab(tabNames.find((name) => name === next) ?? "matches");
              setRemovingId(null);
            }}
          >
            <TabsList
              variant="line"
              aria-label={t("tabs.label")}
              className="pointer-coarse:min-h-11"
            >
              {tabNames.map((name) => (
                <TabsTrigger key={name} value={name} className="pointer-coarse:min-h-11">
                  {t(`tabs.${name}`)}{" "}
                  <span className="text-xs text-muted-foreground">
                    {withNeed(tabs[name], position).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="matches">{listAndPanel}</TabsContent>
            <TabsContent value="shortlist">{listAndPanel}</TabsContent>
            {/* What was removed is a plain list: it has the whole width, and no panel beside it. */}
            <TabsContent value="removed">
              <MatchingRemoved
                candidates={withNeed(tabs.removed, position)}
                operator={operator}
                pendingId={pending}
                onRestore={(candidate) => void restore(candidate, "restored")}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {!wide && (
        <Sheet open={sheetOpen && chosen !== undefined} onOpenChange={setSheetOpen}>
          <SheetContent
            aria-label={chosen?.solutionName}
            showCloseButton={false}
            className="data-[side=right]:w-full data-[side=right]:sm:max-w-md"
          >
            <div className="flex justify-end px-3 pt-3">
              <SheetClose
                render={
                  <IconButton prominence="tertiary" size="lg" aria-label={t("panel.close")} />
                }
              >
                <XIcon aria-hidden="true" />
              </SheetClose>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-6">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export { MatchingBoard };
