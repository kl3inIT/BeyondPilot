import { ApiError } from "@/lib/api/client";
import {
  getAdminUseCase,
  listAdminUseCases,
  listUseCaseOrganizations,
  type AdminUseCase,
  type AdminUseCaseList,
  type UseCaseOrganization,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AdminUseCasesSearch } from "./admin-use-cases-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

/** One page of the operators' list of use cases. Server only. */
export async function readAdminUseCases(search: AdminUseCasesSearch): Promise<AdminUseCaseList> {
  const { data } = await listAdminUseCases({
    ...(await sessionRequest()),
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      status: search.status ?? undefined,
      organizationId: search.organization ?? undefined,
      page: Math.max(1, search.page),
    },
  });
  return data;
}

/** The organizations a use case can be written for, by name. Server only. */
export async function readUseCaseOrganizations(): Promise<UseCaseOrganization[]> {
  const { data } = await listUseCaseOrganizations({ ...(await sessionRequest()), query: {} });
  return data.items;
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
