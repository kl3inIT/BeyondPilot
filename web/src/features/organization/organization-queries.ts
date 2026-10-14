import { knownSort } from "@/lib/list-sort";
import { ApiError } from "@/lib/api/client";
import { failedWith } from "@/lib/api/failure";
import {
  getAdminOrganization,
  getMyOrganization,
  listAdminOrganizations,
  listMyOrganizationMembers,
  type AdminOrganization,
  type AdminOrganizationList,
  type MyOrganization,
  type OrganizationMembers,
  getOrganizationReviewQueue,
  type OrganizationReviewQueue,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AdminOrganizationsSearch } from "./admin-organizations-search";
import { adminOrganizationSortKeys } from "./admin-organizations-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

/** What the person behind this request has to do with organizations. Server only. */
export async function readMyOrganization(): Promise<MyOrganization> {
  const { data } = await getMyOrganization(await sessionRequest());
  return data;
}

/** One page of who belongs to the caller's organization, or `null` when they belong to none. Server only. */
export async function readMembers(
  page = 1,
  size?: number | null,
  sort?: "role" | "-role" | "joined" | "-joined",
): Promise<OrganizationMembers | null> {
  try {
    const { data } = await listMyOrganizationMembers({
      ...(await sessionRequest()),
      query: { page: Math.max(1, page), size: size ?? undefined, sort },
    });
    return data;
  } catch (error) {
    if (failedWith(error, "ORGANIZATION_MEMBERSHIP_REQUIRED")) {
      return null;
    }
    throw error;
  }
}

/** What narrows the operators' list, as the list and its download both send it. */
export function adminOrganizationFilters(search: AdminOrganizationsSearch) {
  return {
    q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
    status: search.status ?? undefined,
    country: search.country ?? undefined,
    sort: knownSort(search.sort, adminOrganizationSortKeys),
  };
}

/** One page of organizations for the operator behind this request. Server only. */
export async function readAdminOrganizations(
  search: AdminOrganizationsSearch,
): Promise<AdminOrganizationList> {
  const { data } = await listAdminOrganizations({
    ...(await sessionRequest()),
    query: {
      ...adminOrganizationFilters(search),
      page: Math.max(1, search.page),
      size: search.size ?? undefined,
    },
  });
  return data;
}

/** One organization as an operator reviews it, or `null` when there is none. Server only. */
export async function readAdminOrganization(id: string): Promise<AdminOrganization | null> {
  try {
    const { data } = await getAdminOrganization({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** How many organizations, new or claimed, wait for review now, and each of the last 14 days. Server only. */
export async function readOrganizationQueue(): Promise<OrganizationReviewQueue> {
  const { data } = await getOrganizationReviewQueue(await sessionRequest());
  return data;
}
