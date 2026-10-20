import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getProgram,
  listPrograms,
  search as searchDirectory,
  type Program,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";
import { maxSearchPage } from "@/lib/page-size";
import type { FeaturedProgramView } from "@/components/sections/featured-program/featured-program";
import type { UpcomingEventView } from "@/components/sections/categories/categories";
import { programRoute } from "@/lib/site";

import type { ProgramsPublicSearch } from "./programs-public-search";

/**
 * The published programs, for everyone. A browse keeps its daily phase calculation for a minute;
 * a semantic result joins fresh summaries so a newly published program cannot be missing from the join.
 */
export async function readPrograms(searching: boolean) {
  const { data } = await listPrograms(
    searching ? { cache: "no-store" } : { next: { revalidate: 60 } },
  );
  return data.items;
}

/** Ranked published programs; the directory summaries already supply every card field. */
export async function readProgramSearch(params: ProgramsPublicSearch) {
  const q = params.q.trim().slice(0, 100);
  if (!q) return null;
  const { data } = await searchDirectory({
    cache: "no-store",
    query: {
      q,
      kind: "program",
      type: params.type ?? undefined,
      phase: params.phase ?? undefined,
      sort: params.sort ?? undefined,
      page: Math.min(maxSearchPage, Math.max(1, params.page)),
      size: params.size ?? undefined,
    },
  });
  return data;
}

/**
 * The program the home page announces: the most recently featured one that still takes applications,
 * with its next key date still to come. Read anonymously and fresh on every visit, not kept: an
 * operator who features a program, or stops, sees the home page follow at once. Null when none is
 * featured, or when the API cannot be reached: the home page renders without it.
 */
export async function readFeaturedProgram(): Promise<FeaturedProgramView | null> {
  try {
    const now = Date.now();
    const { data } = await listPrograms({ query: { featured: true }, cache: "no-store" });
    const featured = data.items.find(
      (program) => program.applications && Date.parse(program.applications.closesAt) > now,
    );
    if (!featured?.applications) {
      return null;
    }
    const { data: page } = await getProgram({ path: { slug: featured.slug }, cache: "no-store" });
    // A day-long key date is still to come until its day is over.
    const day = 24 * 60 * 60 * 1000;
    const next = page.keyDates
      .filter(
        (keyDate) =>
          Date.parse(keyDate.endsAt ?? keyDate.startsAt) + (keyDate.allDay ? day : 0) > now,
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
    return {
      slug: featured.slug,
      name: featured.name,
      partnerName: featured.partnerName,
      summary: featured.summary,
      coverFileId: featured.coverFileId,
      closesAt: featured.applications.closesAt,
      next: next ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * The next events of the published programs, soonest first, for the home page's events card. Read
 * anonymously and kept for a minute, as the list is; none when the API cannot be reached, so the
 * home page renders with the card's line for no events.
 */
export async function readUpcomingEvents(count: number): Promise<UpcomingEventView[]> {
  try {
    const now = Date.now();
    const { data } = await listPrograms({ next: { revalidate: 60 } });
    return data.items
      .flatMap((program) =>
        program.upcomingEvents
          .filter((event) => Date.parse(event.endsAt ?? event.startsAt) > now)
          .map((event) => ({
            title: event.title,
            startsAt: event.startsAt,
            place: [event.city, event.country].filter(Boolean).join(", ") || null,
            online: event.online,
            programName: program.name,
            href:
              event.registrationUrl ??
              (program.pageKind === "external" && program.externalUrl
                ? program.externalUrl
                : programRoute(program.slug)),
          })),
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      .slice(0, count);
  } catch {
    return [];
  }
}

/**
 * A program's page. Server only. It is read as the visitor, so an operator gets a draft to preview;
 * for anyone else a draft or an unknown address is the not-found page.
 */
export async function readProgram(slug: string): Promise<Program> {
  try {
    const { data } = await getProgram({ ...(await sessionRequest()), path: { slug } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && [400, 404].includes(error.status ?? 0)) {
      notFound();
    }
    throw error;
  }
}
