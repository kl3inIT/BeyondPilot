import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { getProgram, listPrograms, type Program } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/**
 * The published programs, for everyone. Server only. The answer is the same for every visitor and
 * a phase moves at most once a day, so it is kept for a minute.
 */
export async function readPrograms() {
  const { data } = await listPrograms({ next: { revalidate: 60 } });
  return data.items;
}

/**
 * A program's page. Server only. It is read as the visitor, so an operator gets a draft to preview;
 * for anyone else a draft or an unknown address is the not-found page.
 */
export async function readProgram(slug: string): Promise<Program> {
  try {
    const { data } = await getProgram({ ...(await sessionRequest()), path: { slug } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && [400, 404].includes(error.status ?? 0)) {
      notFound();
    }
    throw error;
  }
}
