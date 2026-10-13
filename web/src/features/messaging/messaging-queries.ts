import { ApiError } from "@/lib/api/client";
import {
  getConversation,
  getConversationProspect,
  getUnreadMessages,
  listConversations,
  listReportedConversations,
  type ConversationDetail,
  type ConversationList,
  type ConversationProspect,
  type ReportedRequestList,
  type Unread,
} from "@/lib/api/generated";
import { sessionRequest } from "@/lib/auth/session";

import type { MessagingTarget } from "./messaging-search";

/** The caller's conversations in the two lists the screen shows. Server only. */
export async function readConversations(): Promise<ConversationList> {
  const { data } = await listConversations(await sessionRequest());
  return data;
}

/** One conversation of the caller, or `null` when they have none with the identifier. Server only. */
export async function readConversation(id: string): Promise<ConversationDetail | null> {
  try {
    const { data } = await getConversation({ ...(await sessionRequest()), path: { id } });
    return data;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return null;
    }
    throw error;
  }
}

/** Who the caller would write to, or the code of why they may not. */
export type ProspectRead =
  | { prospect: ConversationProspect; refusal?: undefined }
  | { prospect?: undefined; refusal: string };

/**
 * Who the caller would write to at a public address, before anything is written. A refusal the
 * screen explains, such as an address that is the caller's own, comes back as its code. Server only.
 */
export async function readProspect(target: MessagingTarget): Promise<ProspectRead> {
  try {
    const { data } = await getConversationProspect({
      ...(await sessionRequest()),
      query: { kind: target.kind, slug: target.slug },
    });
    return { prospect: data };
  } catch (error) {
    if (error instanceof ApiError && error.code && error.status !== 401) {
      return { refusal: error.code };
    }
    throw error;
  }
}

/** What waits for the caller in Messages, for the account menu. Server only. */
export async function readUnread(): Promise<Unread> {
  const { data } = await getUnreadMessages(await sessionRequest());
  return data;
}

/** One page of the first messages people reported, for the operator behind this request. Server only. */
export async function readReportedRequests(
  page: number,
  size: number | null,
): Promise<ReportedRequestList> {
  const { data } = await listReportedConversations({
    ...(await sessionRequest()),
    query: { page: Math.max(1, page), size: size ?? undefined },
  });
  return data;
}
