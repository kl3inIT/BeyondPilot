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
