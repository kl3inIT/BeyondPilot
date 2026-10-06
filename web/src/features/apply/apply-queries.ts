import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getApplicationForm,
  getMyApplication,
  listMyApplications,
  type ApplicationView,
  type MyApplications,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** A program that takes no applications here, or an application that is not the caller's, is not found. */
function notFoundWhenRefused(error: unknown): never {
  if (error instanceof ApiError && [400, 401, 403, 404, 409].includes(error.status ?? 0)) {
    notFound();
  }
  throw error;
}

/** The application form of a program for the person behind this request. Server only. */
export async function readApplicationForm(slug: string): Promise<ApplicationView> {
  const { data } = await getApplicationForm({
    ...(await sessionRequest()),
    path: { slug },
  }).catch(notFoundWhenRefused);
  return data;
}

/** The applications of the person behind this request. Server only. */
export async function readMyApplications(): Promise<MyApplications> {
  const { data } = await listMyApplications(await sessionRequest()).catch(notFoundWhenRefused);
  return data;
}

/** One application of the person behind this request, with its program. Server only. */
export async function readMyApplication(id: string): Promise<ApplicationView> {
  const { data } = await getMyApplication({ ...(await sessionRequest()), path: { id } }).catch(
    notFoundWhenRefused,
  );
  return data;
}
