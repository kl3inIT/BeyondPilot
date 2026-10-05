import { ApiError } from "@/lib/api/client";
import { getReceivedIntroductions, type ReceivedIntroductions } from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

/** The requests for an introduction to the caller's organization, or `null` when they belong to none. Server only. */
export async function readReceivedIntroductions(): Promise<ReceivedIntroductions | null> {
  try {
    const { data } = await getReceivedIntroductions(await sessionRequest());
    return data;
  } catch (error) {
    if (error instanceof ApiError && error.code === "INTRODUCTION_NEEDS_ORGANIZATION") {
      return null;
    }
    throw error;
  }
}
