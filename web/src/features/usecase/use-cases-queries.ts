import { ApiError } from "@/lib/api/client";
import {
  getUseCase,
  listUseCases,
  search as searchDirectory,
  type PublicUseCase,
  type PublicUseCaseList,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";
import { maxSearchPage } from "@/lib/page-size";

import type { UseCasesSearch } from "./use-cases-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

export type UseCaseList = PublicUseCaseList;

/**
 * One page of the public list, read as the visitor so a signed-in member also gets a budget kept for
 * members. Never kept: a decision shows at once.
 */
export async function readUseCases(search: UseCasesSearch): Promise<UseCaseList> {
  const q = search.q.trim().slice(0, MAX_SEARCH);
  if (q) {
    const { data } = await searchDirectory({
      ...(await sessionRequest()),
      query: {
        q,
        kind: "use_case",
        industry: search.industry.length ? search.industry : undefined,
        proposalStatus: search.proposalStatus ?? undefined,
        sort: search.sort ?? "newest",
        page: Math.min(maxSearchPage, Math.max(1, search.page)),
        size: search.size ?? undefined,
      },
    });
    return {
      ...data,
      items: data.items.map((item) => ({
        id: item.slug,
        title: item.title,
        goal: item.summary,
        industry: item.industries[0],
        technologies: item.technologies,
        organizationName: item.subtitle,
        organizationLogoFileId: item.organizationLogoFileId,
        featured: item.featured!,
        publishedAt: item.publishedAt!,
        closesAt: item.closesAt,
        currency: item.currency!,
        budgetMin: item.budgetMin,
        budgetMax: item.budgetMax,
        budgetMembersOnly: item.budgetMembersOnly!,
        budgetToBeDetermined: item.budgetToBeDetermined!,
        timelineMinWeeks: item.timelineMinWeeks,
        timelineMaxWeeks: item.timelineMaxWeeks,
      })),
    };
  }
  const { data } = await listUseCases({
    ...(await sessionRequest()),
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      industry: search.industry.length === 0 ? undefined : search.industry,
      sort: search.sort === null || search.sort === "relevance" ? "newest" : search.sort,
      proposalStatus: search.proposalStatus ?? undefined,
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
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
    const { data } = await listUseCases({
      ...(await sessionRequest()),
      query: { program, sort: "newest" },
    });
    return data;
  } catch {
    return { items: [], page: 1, pageSize: 0, total: 0 };
  }
}

/**
 * One public brief by identifier, read as the visitor, or `null` when it is unavailable to visitors.
 */
export async function readUseCase(id: string): Promise<PublicUseCase | null> {
  try {
    const { data } = await getUseCase({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
      return null;
    }
    throw error;
  }
}
