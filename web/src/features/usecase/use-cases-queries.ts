import { ApiError } from "@/lib/api/client";
import {
  getUseCase,
  listUseCases,
  type PublicUseCase,
  type PublicUseCaseList,
} from "@/lib/api/generated";

import type { UseCasesSearch } from "./use-cases-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

export type UseCaseList = PublicUseCaseList;

/** One page of the public list. Read without a session and never kept: a decision shows at once. */
export async function readUseCases(search: UseCasesSearch): Promise<UseCaseList> {
  const { data } = await listUseCases({
    cache: "no-store",
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      industry: search.industry.length === 0 ? undefined : search.industry,
      sort: search.sort,
      page: Math.max(1, search.page),
    },
  });
  return data;
}

/**
 * The use cases of a published program, the newest first: the first page of them. A program page
 * shows them beside everything else it tells, so a failed read leaves the page without them.
 */
export async function readProgramUseCases(program: string): Promise<UseCaseList> {
  try {
    const { data } = await listUseCases({ cache: "no-store", query: { program, sort: "newest" } });
    return data;
  } catch {
    return { items: [], page: 1, pageSize: 0, total: 0 };
  }
}

/** One public brief by identifier, or `null` when it is unavailable to visitors. */
export async function readUseCase(id: string): Promise<PublicUseCase | null> {
  try {
    const { data } = await getUseCase({ cache: "no-store", path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
