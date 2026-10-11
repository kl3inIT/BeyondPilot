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
