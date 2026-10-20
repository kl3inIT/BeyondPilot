import { timelinePresets } from "./admin-use-case-codes";

type TimelineKey = "single" | "range" | "under" | "atLeast";

/**
 * A use case's timeline as one line, through the catalog's `UseCases.timeline` messages. Weeks the
 * form offers as a choice read as that choice ("Under 4 weeks", "24 weeks or more"), not as the
 * numbers it stores for it; equal weeks read once ("13 weeks"), as cases imported from v1 hold them.
 */
function timelineText(
  min: number,
  max: number,
  say: (key: TimelineKey, values: Record<string, number>) => string,
): string {
  const { under_4: under, over_24: atLeast } = timelinePresets;
  if (min === under.min && max === under.max) {
    return say("under", { weeks: max });
  }
  if (min === atLeast.min && max === atLeast.max) {
    return say("atLeast", { weeks: min });
  }
  return min === max ? say("single", { weeks: min }) : say("range", { min, max });
}

export { timelineText };
