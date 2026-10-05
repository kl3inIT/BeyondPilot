import { ApiError } from "@/lib/api/client";
import {
  getAdminOrganization,
  getMyOrganization,
  listAdminOrganizations,
  listMyOrganizationMembers,
  type AdminOrganization,
  type AdminOrganizationList,
  type MyOrganization,
  type OrganizationMembers,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { AdminOrganizationsSearch } from "./admin-organizations-search";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

/** What the person behind this request has to do with organizations. Server only. */
export async function readMyOrganization(): Promise<MyOrganization> {
  const { data } = await getMyOrganization(await sessionRequest());
  return data;
}

/** Who belongs to the caller's organization, or `null` when they belong to none. Server only. */
export async function readMembers(): Promise<OrganizationMembers | null> {
  try {
    const { data } = await listMyOrganizationMembers(await sessionRequest());
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.code === "ORGANIZATION_MEMBERSHIP_REQUIRED") {
      return null;
    }
    throw error;
  }
}

/** One page of organizations for the operator behind this request. Server only. */
export async function readAdminOrganizations(
  search: AdminOrganizationsSearch,
): Promise<AdminOrganizationList> {
  const { data } = await listAdminOrganizations({
    ...(await sessionRequest()),
    query: {
      q: search.q.trim().slice(0, MAX_SEARCH) || undefined,
      status: search.status ?? undefined,
      page: Math.max(1, search.page),
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
