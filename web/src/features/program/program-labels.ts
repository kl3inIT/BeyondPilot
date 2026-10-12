import type { AdminProgramSummary } from "@/lib/api/generated";

type BadgeVariant = "outline" | "success" | "info";

/**
 * How a program's state reads on the operators' list: a draft is a draft whatever its dates; a
 * published program shows the phase its dates put it in. Open is the one that takes action.
 */
export function programState(program: Pick<AdminProgramSummary, "status" | "phase">): {
  key: "draft" | AdminProgramSummary["phase"];
  variant: BadgeVariant;
} {
  if (program.status === "draft") {
    return { key: "draft", variant: "outline" };
  }
  const variants: Record<AdminProgramSummary["phase"], BadgeVariant> = {
    upcoming: "info",
    open: "success",
    running: "info",
    done: "outline",
  };
  return { key: program.phase, variant: variants[program.phase] };
}

/** What a published program waits for next: a moment of its application window, or a day. */
export type ProgramNext =
  | { kind: "opens" | "closes"; at: string }
  | { kind: "outcomes" | "starts" | "ends" | "ended"; day: string };

/**
 * Where a program stands at a moment and what it waits for next, worked out from its dates as the
 * backend works out the phase of the list (program › ProgramPhase): Settings reads the program
 * without its phase. `today` is the day in Vietnam, written `2026-10-15`; days compare as text.
 */
export function programStanding(
  program: {
    startsOn?: string | null;
    endsOn?: string | null;
    applications?: { opensAt: string; closesAt: string; outcomesDueOn?: string | null } | null;
  },
  now: number,
  today: string,
): { phase: AdminProgramSummary["phase"]; next: ProgramNext | null } {
  const { startsOn, endsOn, applications } = program;
  const opensAt = applications ? Date.parse(applications.opensAt) : null;
  const closesAt = applications ? Date.parse(applications.closesAt) : null;
  if (endsOn && today > endsOn) {
    return { phase: "done", next: { kind: "ended", day: endsOn } };
  }
  if (applications && opensAt !== null && closesAt !== null && now >= opensAt && now < closesAt) {
    return { phase: "open", next: { kind: "closes", at: applications.closesAt } };
  }
  if (applications && opensAt !== null && now < opensAt) {
    return { phase: "upcoming", next: { kind: "opens", at: applications.opensAt } };
  }
  if (startsOn && today < startsOn) {
    return { phase: "upcoming", next: { kind: "starts", day: startsOn } };
  }
  const outcomes = applications?.outcomesDueOn;
  if (outcomes && today <= outcomes) {
    return { phase: "running", next: { kind: "outcomes", day: outcomes } };
  }
  return { phase: "running", next: endsOn ? { kind: "ends", day: endsOn } : null };
}
