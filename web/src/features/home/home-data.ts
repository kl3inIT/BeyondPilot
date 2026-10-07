import type { DirectoryData, DirectoryProgram } from "@/components/sections/directory/directory";
import type { EventsData } from "@/components/sections/events/programs-events";
import type { HeroCardsData } from "@/components/sections/hero/floating-cards";
import { ApiError } from "@/lib/api/client";
import {
  listPrograms,
  listSolutions,
  listUseCases,
  type ProgramSummary,
  type PublicSolutionSummary,
} from "@/lib/api/generated";
import { publicFileUrl } from "@/lib/storage/upload";

/** The landing reads what every visitor sees alike, so a read is kept for five minutes. */
const cache = { next: { revalidate: 300 } } as const;

/** The program whose sessions the landing lists as the next meetups. */
const meetupSlug = "genai-builders-meetup";

/** How many cards a directory tab and the past programs show. */
const shown = 3;

/**
 * A read the landing can do without: its failure is logged as one line of JSON, without the
 * error's text (docs/conventions.md › Logging), and the section renders without that data.
 */
async function optional<T>(subject: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "web.home.read_failed",
        subject,
        error_type: error instanceof Error ? error.name : typeof error,
        status: error instanceof ApiError ? error.status : undefined,
      }),
    );
    return null;
  }
}

function coverOf(program: ProgramSummary) {
  return program.coverFileId ? publicFileUrl(program.coverFileId) : null;
}

function directoryProgram(program: ProgramSummary): DirectoryProgram {
  return {
    slug: program.slug,
    name: program.name,
    type: program.type,
    partnerName: program.partnerName ?? null,
    coverUrl: coverOf(program),
    open: program.phase === "open",
    closesAt: program.phase === "open" ? (program.applications?.closesAt ?? null) : null,
  };
}

/** Open programs first, then those to come, then the latest that ended. */
const phaseOrder = { open: 0, running: 1, upcoming: 2, done: 3 } as const;

function byPhaseThenRecent(a: ProgramSummary, b: ProgramSummary) {
  return (
    phaseOrder[a.phase] - phaseOrder[b.phase] || (b.endsOn ?? "").localeCompare(a.endsOn ?? "")
  );
}

/** Solutions with a logo first, so the cards show marks rather than initials while they can. */
function withLogoFirst(solutions: PublicSolutionSummary[]) {
  return [...solutions].sort(
    (a, b) => Number(Boolean(b.logoFileId)) - Number(Boolean(a.logoFileId)),
  );
}

export type HomeData = {
  directory: DirectoryData;
  events: EventsData;
  heroCards: HeroCardsData;
};

/** What the landing shows of the directories and the programs. Server only. */
export async function readHome(): Promise<HomeData> {
  const [programs, useCases, solutions] = await Promise.all([
    optional("programs", async () => (await listPrograms(cache)).data.items),
    optional(
      "use_cases",
      async () => (await listUseCases({ ...cache, query: { sort: "newest" } })).data,
    ),
    optional(
      "solutions",
      async () => (await listSolutions({ ...cache, query: { sort: "newest" } })).data,
    ),
  ]);

  const ordered = [...(programs ?? [])].sort(byPhaseThenRecent);
  const done = ordered.filter((program) => program.phase === "done");
  const meetup =
    ordered.find((program) => program.slug === meetupSlug && program.upcomingEvents.length > 0) ??
    ordered.find(
      (program) =>
        (program.phase === "upcoming" || program.phase === "running") &&
        program.upcomingEvents.length > 0,
    );
  const featured = ordered.find(
    (program) => program.phase !== "done" && program.slug !== meetup?.slug && program.coverFileId,
  );
  const lastDone = done.find((program) => program.coverFileId);

  return {
    directory: {
      counts: {
        programs: programs ? programs.length : null,
        useCases: useCases ? useCases.total : null,
        solutions: solutions ? solutions.total : null,
      },
      programs: ordered.slice(0, shown).map(directoryProgram),
      useCases: (useCases?.items ?? []).slice(0, shown).map((useCase) => ({
        id: useCase.id,
        title: useCase.title,
        industry: useCase.industry,
      })),
      solutions: withLogoFirst(solutions?.items ?? [])
        .slice(0, shown)
        .map((solution) => ({
          slug: solution.slug,
          name: solution.name,
          summary: solution.summary ?? null,
          country: solution.country ?? null,
          logoUrl: solution.logoFileId ? publicFileUrl(solution.logoFileId) : null,
        })),
    },
    events: {
      meetup: meetup
        ? {
            name: meetup.name,
            recurring: meetup.slug === meetupSlug,
            dates: meetup.upcomingEvents.slice(0, shown).map((event) => event.startsAt),
          }
        : null,
      past: done.slice(0, shown).map((program) => ({
        slug: program.slug,
        name: program.name,
        type: program.type,
        partnerName: program.partnerName ?? null,
        coverUrl: coverOf(program),
        startsOn: program.startsOn ?? null,
        endsOn: program.endsOn ?? null,
      })),
    },
    heroCards: {
      featured: featured
        ? {
            name: featured.name,
            type: featured.type,
            partnerName: featured.partnerName ?? null,
            coverUrl: coverOf(featured),
          }
        : null,
      past: lastDone
        ? {
            name: lastDone.name,
            type: lastDone.type,
            partnerName: lastDone.partnerName ?? null,
            coverUrl: coverOf(lastDone),
          }
        : null,
      nextEvent:
        meetup && meetup.upcomingEvents[0]
          ? {
              name: meetup.name,
              startsAt: meetup.upcomingEvents[0].startsAt,
              recurring: meetup.slug === meetupSlug,
            }
          : null,
    },
  };
}
