import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getAdminProgram,
  listAdminPrograms,
  type AdminProgram,
  type AdminProgramList,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/**
 * A read that is refused because the role was withdrawn or the session ended after the page checked
 * it, or that names a program which does not exist, shows the not-found page.
 */
function notFoundWhenRefused(error: unknown): never {
  if (error instanceof ApiError && [400, 401, 403, 404].includes(error.status ?? 0)) {
    notFound();
  }
  throw error;
}

/** Every program for the operator behind this request. Server only. */
export async function readAdminPrograms(): Promise<AdminProgramList> {
  const { data } = await listAdminPrograms(await sessionRequest()).catch(notFoundWhenRefused);
  return data;
}

/** One program as its Settings edit it. Server only. */
export async function readAdminProgram(id: string): Promise<AdminProgram> {
  const { data } = await getAdminProgram({ ...(await sessionRequest()), path: { id } }).catch(
    notFoundWhenRefused,
  );
  return data;
}
