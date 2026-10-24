import { isActive } from "@/features/organization/organization-format";
import { ApiError } from "@/lib/api/client";
import {
  getMyUseCase,
  getMyUseCaseAccess,
  getMyUseCasePreview,
  listMyUseCases,
  type MyOrganization,
  type MyUseCase,
  type MyUseCases,
  type Organization,
  type UseCaseAccess,
  type UseCasePreview,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** The use cases of the caller's organization. Server only. */
export async function readMyUseCases(): Promise<MyUseCases> {
  const { data } = await listMyUseCases(await sessionRequest());
  return data;
}

/** One use case of the caller's organization, or `null` when it has none such. Server only. */
export async function readMyUseCase(id: string): Promise<MyUseCase | null> {
  try {
    const { data } = await getMyUseCase({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** Who may do what with a use case of the caller's organization, or `null` when the caller cannot see it. Server only. */
export async function readMyUseCaseAccess(id: string): Promise<UseCaseAccess | null> {
  try {
    const { data } = await getMyUseCaseAccess({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** The read-only link of a use case of the caller's organization, or `null` when the caller may not read it. Server only. */
export async function readMyUseCasePreview(id: string): Promise<UseCasePreview | null> {
  try {
    const { data } = await getMyUseCasePreview({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 403 || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

/** Whether an organization has use cases at all: one that is not taken down does. */
export function hasUseCases(organization: Organization): boolean {
  return isActive(organization);
}

/** How many use cases the organization has for its tab, or `null` when it has no such tab. Server only. */
export async function readUseCaseCount(
  mine: MyOrganization & { organization: Organization },
): Promise<number | null> {
  if (!hasUseCases(mine.organization)) {
    return null;
  }
  try {
    return (await readMyUseCases()).items.length;
  } catch (error) {
    // The membership changed between the two reads: the tab is simply not drawn.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }
    throw error;
  }
}
