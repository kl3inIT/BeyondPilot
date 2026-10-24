import { knownSort } from "@/lib/list-sort";
import { ApiError } from "@/lib/api/client";
import {
  getAdminUseCase,
  getAdminUseCaseAccess,
  getAdminUseCasePreview,
  listAdminUseCases,
  type AdminUseCase,
  type AdminUseCaseList,
  type UseCaseAccess,
  type UseCasePreview,
  getUseCaseReviewQueue,
  type UseCaseReviewQueue,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AdminUseCasesSearch } from "./admin-use-cases-search";
import { adminUseCaseSortKeys } from "./admin-use-cases-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

/** What narrows the list as the backend reads it, for the page and for its download. */
export function adminUseCaseFilters(search: AdminUseCasesSearch) {
  return {
    q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
    status: search.status ?? undefined,
    organizationId: search.organization ?? undefined,
    featured: search.featured === null ? undefined : search.featured === "true",
    sort: knownSort(search.sort, adminUseCaseSortKeys),
  };
}

/** One page of the operators' list of use cases. Server only. */
export async function readAdminUseCases(search: AdminUseCasesSearch): Promise<AdminUseCaseList> {
  const { data } = await listAdminUseCases({
    ...(await sessionRequest()),
    query: {
      ...adminUseCaseFilters(search),
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/** One use case as an operator reads it, or `null` when there is none. Server only. */
export async function readAdminUseCase(id: string): Promise<AdminUseCase | null> {
  try {
    const { data } = await getAdminUseCase({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** How many use cases wait for review now, and each of the last 14 days. Server only. */
export async function readUseCaseQueue(): Promise<UseCaseReviewQueue> {
  const { data } = await getUseCaseReviewQueue(await sessionRequest());
  return data;
}

/** Who may do what with a use case, as an operator reads it, or `null` when there is no such use case. Server only. */
export async function readAdminUseCaseAccess(id: string): Promise<UseCaseAccess | null> {
  try {
    const { data } = await getAdminUseCaseAccess({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** The read-only link of a use case, as an operator reads it, or `null` when there is no such use case. Server only. */
export async function readAdminUseCasePreview(id: string): Promise<UseCasePreview | null> {
  try {
    const { data } = await getAdminUseCasePreview({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}
