"use client";

import { cn } from "cn";
import { ChevronDownIcon, RotateCwIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useNotify } from "@/hooks/use-notify";
import { useFormatter } from "@/i18n/format";
import { clockText, momentText } from "@/i18n/formats";
import {
  startEvaluation,
  type EvaluationBoard as Board,
  type EvaluationCandidate,
} from "@/lib/api/generated";
import { adminProgramEvaluationRoute, adminUseCaseCandidatesRoute } from "@/lib/site";

import { SolutionLogo } from "../solution/solution-logo";

import { useEvaluationDecide, type Verdict } from "./evaluation-decide";
import { EvaluationPanel } from "./evaluation-panel";
import {
  attentionOf,
  decisionCounts,
  decisionOf,
  decisions,
  differs,
  filtered,
  keyOf,
  labelTone,
  noFilter,
  tierColour,
  tierCounts,
  tiers,
  tierVariant,
  tintOf,
  type Filter,
} from "./evaluation-view";
import { ARROWED, FIELDS, OVERLAYS } from "./matching-keys";

/** From this width the chosen candidate is read beside the list; below it, in a sheet over it. */
const WIDE = "(min-width: 1280px)";

/** How many candidates are compared side by side at most. */
const COMPARED = 4;

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

type EvaluationBoardProps = {
  board: Board;
  /** Whether the program's outcomes were released: an application's decision no longer changes. */
  released: boolean;
};

/**
 * A program's submissions as candidates, with the tier the AI suggests (BEY-234): the run and its
 * action, the use cases read against, the filters, the list and one candidate read in full beside
 * it on a wide screen or in a sheet below that. J and K step through the list, S shortlists, N marks
 * not selected; two to four candidates are compared side by side. Every change reads the page again.
 */
function EvaluationBoard({ board, released }: EvaluationBoardProps) {
  const t = useTranslations("Matching.evaluation");
  const router = useRouter();
  const notify = useNotify();
  const searchId = useId();
  const wide = useSyncExternalStore(
    subscribeToWidth,
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
  const [filter, setFilter] = useState<Filter>(noFilter);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [compared, setCompared] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [starting, setStarting] = useState<"run" | "all" | null>(null);
  const { decide, pending } = useEvaluationDecide(board.programId);

  const shown = filtered(board.candidates, filter);
  const counts = decisionCounts(board.candidates);
  const chosen =
    shown.find((candidate) => keyOf(candidate) === selectedKey) ?? (wide ? shown[0] : undefined);
  const place = chosen ? shown.indexOf(chosen) : -1;
  const panelOpen = chosen !== undefined && (wide || sheetOpen);
  const narrowed =
    filter.search.trim() !== "" ||
    filter.tier !== "all" ||
    filter.decision !== "all" ||
    filter.attention;

  function select(candidate: EvaluationCandidate) {
    setSelectedKey(keyOf(candidate));
    setSheetOpen(true);
  }

  const step = (by: number) => {
    const next = shown[place + by];
    if (next) {
      setSelectedKey(keyOf(next));
    }
  };

  const onDecide = (candidate: EvaluationCandidate, verdict: Verdict) =>
    void decide(candidate, verdict);

  async function start(assessAll: boolean) {
    setStarting(assessAll ? "all" : "run");
    try {
      await startEvaluation({ path: { programId: board.programId }, body: { assessAll } });
      notify.success(
        assessAll ? "Matching.evaluation.run.startedAll" : "Matching.evaluation.run.started",
      );
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setStarting(null);
    }
  }

  // With a candidate open, J and K (or the up and down arrows) step through the list, S shortlists it and
  // N marks it not selected. A key held with a modifier, typed in a field, or pressed while a dialog or a
  // menu lies over the page is left alone.
  const onKey = useEffectEvent((event: KeyboardEvent) => {
    if (
      !chosen ||
      event.defaultPrevented ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(FIELDS) || document.querySelector(OVERLAYS)) {
      return;
    }
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if ((key === "j" || key === "ArrowDown") && !target?.closest(ARROWED)) {
      event.preventDefault();
      step(1);
    } else if ((key === "k" || key === "ArrowUp") && !target?.closest(ARROWED)) {
      event.preventDefault();
      step(-1);
    } else if ((key === "s" || key === "n") && pending === null) {
      event.preventDefault();
      onDecide(chosen, key === "s" ? "shortlisted" : "not_selected");
    }
  });
  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const listen = (event: KeyboardEvent) => onKey(event);
    window.addEventListener("keydown", listen, true);
    return () => window.removeEventListener("keydown", listen, true);
  }, [panelOpen]);

  const panel = chosen && (
    <EvaluationPanel
      candidate={chosen}
      programId={board.programId}
      released={released}
      pending={pending === keyOf(chosen)}
      onDecide={(verdict) => onDecide(chosen, verdict)}
      onPrevious={place > 0 ? () => step(-1) : undefined}
      onNext={place < shown.length - 1 ? () => step(1) : undefined}
      fullPageHref={adminProgramEvaluationRoute(
        board.programId,
        chosen.organizationId,
        chosen.solutionId,
      )}
    />
  );

  const toggleCompared = (candidate: EvaluationCandidate, on: boolean) =>
    setCompared((current) =>
      on
        ? current.length < COMPARED
          ? [...current, keyOf(candidate)]
          : current
        : current.filter((key) => key !== keyOf(candidate)),
    );
  const comparedCandidates = board.candidates.filter((candidate) =>
    compared.includes(keyOf(candidate)),
  );

  return (
    <div className="flex flex-col gap-5">
      <RunBar
        board={board}
        starting={starting}
        onStart={start}
        onRefresh={() => router.refresh()}
      />

      {board.useCases.length > 0 && (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
          <span className="text-muted-foreground">{t("useCases")}</span>
          {board.useCases.map((useCase, index) => (
            <span key={useCase.id}>
              <TextButton size="sm" href={adminUseCaseCandidatesRoute(useCase.id)}>
                {useCase.title}
              </TextButton>
              {index < board.useCases.length - 1 && <span aria-hidden="true">,</span>}
            </span>
          ))}
        </p>
      )}

      {board.candidates.length === 0 ? (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          {t("empty.none")}
        </p>
      ) : (
        <>
          <TierSpread
            candidates={board.candidates}
            value={filter.tier}
            onChange={(tier) => setFilter({ ...filter, tier })}
          />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="md:w-72">
                <label htmlFor={searchId} className="sr-only">
                  {t("filter.search")}
                </label>
                <Input
                  id={searchId}
                  type="search"
                  placeholder={t("filter.search")}
                  value={filter.search}
                  onChange={(event) => setFilter({ ...filter, search: event.target.value })}
                />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox
                  checked={filter.attention}
                  onCheckedChange={(checked) =>
                    setFilter({ ...filter, attention: checked === true })
                  }
                />
                {t("filter.attention")}
              </label>
            </div>
            <ToggleGroup
              aria-label={t("filter.decision")}
              variant="outline"
              size="sm"
              className="w-full flex-wrap"
              value={[filter.decision]}
              onValueChange={(next) =>
                setFilter({
                  ...filter,
                  decision: decisions.find((one) => one === next[0]) ?? "all",
                })
              }
            >
              <ToggleGroupItem value="all" className="pointer-coarse:min-h-11">
                {t("filter.all")} <span className="text-muted-foreground">{counts.all}</span>
              </ToggleGroupItem>
              {decisions.map((one) => (
                <ToggleGroupItem key={one} value={one} className="pointer-coarse:min-h-11">
                  {t(`decisions.${one}`)}{" "}
                  <span className="text-muted-foreground">{counts[one]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {narrowed && (
              <p
                role="status"
                className="flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground"
              >
                {t("filter.showing", { count: shown.length, total: board.candidates.length })}
                <TextButton size="sm" onClick={() => setFilter(noFilter)}>
                  {t("filter.clear")}
                </TextButton>
              </p>
            )}
          </div>

          {compared.length > 0 && (
            <div
              role="region"
              aria-label={t("compare.title")}
              className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2 text-sm"
            >
              <span>{t("compare.selected", { count: compared.length })}</span>
              <Button size="sm" disabled={compared.length < 2} onClick={() => setComparing(true)}>
                {t("compare.open")}
              </Button>
              <TextButton size="sm" onClick={() => setCompared([])}>
                {t("compare.clear")}
              </TextButton>
              {compared.length >= COMPARED && (
                <span className="text-muted-foreground">{t("compare.max")}</span>
              )}
            </div>
          )}

          <div className="grid items-start gap-6 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              {shown.length === 0 ? (
                <div className="flex flex-col items-start gap-2 rounded-xl border bg-card p-6">
                  <p className="text-sm text-muted-foreground">{t("empty.filtered")}</p>
                  <TextButton onClick={() => setFilter(noFilter)}>{t("filter.clear")}</TextButton>
                </div>
              ) : (
                <div className="rounded-xl border bg-card">
                  <div
                    aria-hidden="true"
                    className="hidden grid-cols-12 gap-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground md:grid"
                  >
                    <span className="col-span-1" />
                    <span className="col-span-4">{t("columns.candidate")}</span>
                    <span className="col-span-2">{t("columns.suggestion")}</span>
                    <span className="col-span-3">{t("columns.concern")}</span>
                    <span className="col-span-2">{t("columns.decision")}</span>
                  </div>
                  <ul className="flex flex-col divide-y">
                    {shown.map((candidate) => (
                      <li key={keyOf(candidate)}>
                        <Row
                          candidate={candidate}
                          selected={
                            chosen !== undefined && keyOf(chosen) === keyOf(candidate) && panelOpen
                          }
                          compared={compared.includes(keyOf(candidate))}
                          compareFull={compared.length >= COMPARED}
                          onSelect={() => select(candidate)}
                          onCompare={(on) => toggleCompared(candidate, on)}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {wide && (
              <div className="hidden xl:sticky xl:top-0 xl:col-span-2 xl:-my-4 xl:flex xl:max-h-dvh xl:flex-col xl:py-4">
                <aside
                  aria-label={t("panel.label")}
                  className="min-h-0 overflow-y-auto overscroll-contain rounded-xl border bg-card p-5"
                >
                  {panel || <p className="text-sm text-muted-foreground">{t("panel.empty")}</p>}
                </aside>
              </div>
            )}
          </div>
        </>
      )}

      {!wide && (
        <Sheet open={sheetOpen && chosen !== undefined} onOpenChange={setSheetOpen}>
          <SheetContent
            aria-label={chosen?.organizationName}
            data-panel="matching"
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

      <Dialog open={comparing} onOpenChange={setComparing}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("compare.title")}</DialogTitle>
            <DialogDescription>{t("about")}</DialogDescription>
          </DialogHeader>
          <Compare candidates={comparedCandidates} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The last run, what it is doing or why it stopped, and the actions that start one. */
function RunBar({
  board,
  starting,
  onStart,
  onRefresh,
}: {
  board: Board;
  starting: "run" | "all" | null;
  onStart: (assessAll: boolean) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("Matching.evaluation.run");
  const format = useFormatter();
  const run = board.run;
  const open = run && ["queued", "running", "waiting"].includes(run.state);
  const blocked = !board.modelChosen
    ? t("noModel")
    : board.useCases.length === 0
      ? t("noUseCase")
      : null;

  let line: string;
  if (!run) {
    line = t("none");
  } else if (run.state === "queued") {
    line = run.notBefore
      ? t("queued", { time: clockText(format, new Date(run.notBefore)) })
      : t("queuedNow");
  } else if (run.state === "running") {
    line = t("running", { assessed: run.assessed, total: run.total });
  } else if (run.state === "waiting") {
    line = t("waiting", { time: clockText(format, new Date(run.resumeAt ?? run.createdAt)) });
  } else if (run.state === "done") {
    line = t("done", {
      when: momentText(format, new Date(run.endedAt ?? run.createdAt)),
      model: run.modelName ?? "",
    });
  } else {
    const reason = run.failure;
    line = t("failed", {
      reason: t(
        `failures.${reason === "no_use_case" || reason === "no_model" || reason === "request_refused" ? reason : "other"}`,
      ),
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <p role="status" className="text-sm font-medium">
          {line}
        </p>
        {blocked && <p className="text-sm text-muted-foreground">{blocked}</p>}
        {run?.state === "running" && run.total > 0 && (
          <Progress
            aria-label={line}
            value={(run.assessed / run.total) * 100}
            className="max-w-xs"
          />
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {open && (
          <Button size="sm" prominence="tertiary" onClick={onRefresh}>
            <RotateCwIcon aria-hidden="true" />
            {t("refresh")}
          </Button>
        )}
        {!blocked && (
          <div className="flex">
            <Button
              size="sm"
              className="rounded-e-none"
              pending={starting === "run"}
              disabled={starting !== null || run?.state === "running"}
              onClick={() => onStart(false)}
            >
              {t("start")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <IconButton
                    size="sm"
                    className="rounded-s-none border-s border-primary-foreground/20"
                    aria-label={t("more")}
                    disabled={starting !== null || run?.state === "running"}
                  />
                }
              >
                <ChevronDownIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => onStart(true)}>{t("all")}</DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * How the candidates spread over the tiers, as one bar of their colours, and the filter by tier: each
 * share of the bar has its toggle below it, with its count. Choosing the chosen one again shows all.
 */
function TierSpread({
  candidates,
  value,
  onChange,
}: {
  candidates: EvaluationCandidate[];
  value: Filter["tier"];
  onChange: (tier: Filter["tier"]) => void;
}) {
  const t = useTranslations("Matching.evaluation");
  const counts = tierCounts(candidates);
  const shares = [...tiers, "waiting" as const].filter((tier) => counts[tier] > 0);
  const label = (tier: (typeof shares)[number]) =>
    tier === "waiting" ? t("states.waiting") : t(`tiers.${tier}`);

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div aria-hidden="true" className="flex h-3 gap-0.5 overflow-hidden rounded-full">
        {shares.map((tier) => (
          <span
            key={tier}
            style={{ "--share": counts[tier] } as React.CSSProperties}
            className={cn(
              "grow-(--share) basis-0 transition-opacity motion-reduce:transition-none",
              tierColour[tier].fill,
              value !== "all" && value !== tier && "opacity-25",
            )}
          />
        ))}
      </div>
      <ToggleGroup
        aria-label={t("filter.tier")}
        size="sm"
        className="w-full flex-wrap"
        value={[value]}
        onValueChange={(next) =>
          onChange([...tiers, "waiting" as const].find((tier) => tier === next[0]) ?? "all")
        }
      >
        <ToggleGroupItem value="all" className="pointer-coarse:min-h-11">
          {t("filter.all")} <span className="text-muted-foreground">{candidates.length}</span>
        </ToggleGroupItem>
        {shares.map((tier) => (
          <ToggleGroupItem key={tier} value={tier} className="pointer-coarse:min-h-11">
            <span
              aria-hidden="true"
              className={cn("size-2.5 rounded-full", tierColour[tier].fill)}
            />
            {label(tier)} <span className="text-muted-foreground">{counts[tier]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** One candidate in the list: compare, its names and records, the AI's tier, its main concern, the decision. */
function Row({
  candidate,
  selected,
  compared,
  compareFull,
  onSelect,
  onCompare,
}: {
  candidate: EvaluationCandidate;
  selected: boolean;
  compared: boolean;
  compareFull: boolean;
  onSelect: () => void;
  onCompare: (on: boolean) => void;
}) {
  const t = useTranslations("Matching.evaluation");
  const assessment = candidate.assessment;
  const decided = decisionOf(candidate);
  const attention = attentionOf(candidate);
  const kinds = candidate.records.filter((record) => record.status !== "draft");
  const colour = tierColour[assessment?.tier ?? "waiting"];

  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        "flex gap-3 border-l-4 px-3 py-3 md:grid md:grid-cols-12 md:items-center data-selected:bg-accent",
        colour.edge,
      )}
    >
      <span className="flex min-h-11 shrink-0 items-start justify-center md:col-span-1 md:items-center">
        <Checkbox
          aria-label={t("compare.select", { name: candidate.organizationName })}
          checked={compared}
          disabled={!compared && compareFull}
          onCheckedChange={(checked) => onCompare(checked === true)}
        />
      </span>
      {/* One column of cells on a phone; each cell its own column of the grid from md on. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 md:contents">
        <button
          type="button"
          aria-current={selected || undefined}
          onClick={onSelect}
          className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:col-span-4"
        >
          <SolutionLogo
            size="row"
            name={candidate.solutionName || candidate.organizationName}
            fileId={candidate.logoFileId}
            className={cn(
              "size-9",
              !candidate.logoFileId && tintOf(candidate.solutionName || candidate.organizationName),
            )}
          />
          <span className="flex min-w-0 flex-col">
            <span className="font-medium wrap-break-word">{candidate.organizationName}</span>
            <span className="line-clamp-2 text-sm wrap-break-word text-muted-foreground">
              {candidate.solutionName}
              {kinds.length > 0 && (
                <>
                  {" · "}
                  {kinds.map((record) => t(`records.${record.kind}`)).join(", ")}
                </>
              )}
            </span>
          </span>
        </button>
        <span className="flex flex-wrap items-center gap-1.5 md:col-span-2">
          {assessment ? (
            <>
              <Badge variant={tierVariant[assessment.tier]}>{t(`tiers.${assessment.tier}`)}</Badge>
              {assessment.provisional && <Badge variant="outline">{t("provisional")}</Badge>}
              <span className="text-xs text-muted-foreground">
                {t(`alignment.${assessment.alignment}`)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">{t("states.waiting")}</span>
          )}
          {attention.outdated && (
            <span className="text-xs text-muted-foreground">{t("states.outdated")}</span>
          )}
        </span>
        <span className="text-sm wrap-break-word text-muted-foreground md:col-span-3 md:line-clamp-2">
          {assessment?.notes.concern}
        </span>
        <span className="flex flex-wrap items-center gap-1.5 md:col-span-2">
          <Status
            appearance="pill"
            tone={
              decided === "shortlisted"
                ? "success"
                : decided === "not_selected"
                  ? "neutral"
                  : "warning"
            }
          >
            {t(`decisions.${decided}`)}
          </Status>
          {differs(candidate) && (
            <span className="text-xs text-muted-foreground">{t("differs")}</span>
          )}
        </span>
      </div>
    </div>
  );
}

/** Two to four candidates side by side: tier, alignment, the notes and each criterion's findings. */
function Compare({ candidates }: { candidates: EvaluationCandidate[] }) {
  const t = useTranslations("Matching.evaluation");
  const keys = ["team", "traction", "readiness", "product", "funding", "proposal"] as const;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-2xl border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              {t("columns.candidate")}
            </th>
            {candidates.map((candidate) => (
              <th
                key={keyOf(candidate)}
                scope="col"
                className="border-b p-2 text-left align-top font-semibold"
              >
                <span className="block wrap-break-word">{candidate.organizationName}</span>
                <span className="block font-normal text-muted-foreground">
                  {candidate.solutionName}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <CompareRow label={t("columns.suggestion")} candidates={candidates}>
            {(candidate) =>
              candidate.assessment ? (
                <span className="flex flex-wrap gap-1.5">
                  <Badge variant={tierVariant[candidate.assessment.tier]}>
                    {t(`tiers.${candidate.assessment.tier}`)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {t(`alignment.${candidate.assessment.alignment}`)}
                  </span>
                </span>
              ) : (
                t("states.waiting")
              )
            }
          </CompareRow>
          <CompareRow label={t("panel.why")} candidates={candidates}>
            {(candidate) => candidate.assessment?.notes.why}
          </CompareRow>
          <CompareRow label={t("panel.concern")} candidates={candidates}>
            {(candidate) => candidate.assessment?.notes.concern}
          </CompareRow>
          <CompareRow label={t("panel.nextStep")} candidates={candidates}>
            {(candidate) => candidate.assessment?.notes.next}
          </CompareRow>
          {keys.map((key) => (
            <CompareRow key={key} label={t(`criteria.${key}`)} candidates={candidates}>
              {(candidate) => (
                <ul className="flex flex-col gap-1">
                  {candidate.assessment?.criteria
                    .find((criterion) => criterion.key === key)
                    ?.findings.map((finding, index) => (
                      <li key={index} className="flex flex-col gap-0.5">
                        <Status appearance="pill" tone={labelTone[finding.label]}>
                          {t(`labels.${finding.label}`)}
                        </Status>
                        <span className="wrap-break-word">{finding.summary}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CompareRow>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompareRow({
  label,
  candidates,
  children,
}: {
  label: string;
  candidates: EvaluationCandidate[];
  children: (candidate: EvaluationCandidate) => React.ReactNode;
}) {
  return (
    <tr>
      <th scope="row" className="w-32 border-b p-2 text-left align-top font-medium">
        {label}
      </th>
      {candidates.map((candidate) => (
        <td key={keyOf(candidate)} className="border-b p-2 align-top wrap-break-word">
          {children(candidate)}
        </td>
      ))}
    </tr>
  );
}

export { EvaluationBoard };
