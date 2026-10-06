import { ApiError } from "@/lib/api/client";
import {
  getMyUseCase,
  listMyUseCases,
  type MyOrganization,
  type MyUseCase,
  type MyUseCases,
  type Organization,
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

/** Whether an organization has use cases at all: an approved organization does. */
export function hasUseCases(organization: Organization): boolean {
  return organization.status === "approved";
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
