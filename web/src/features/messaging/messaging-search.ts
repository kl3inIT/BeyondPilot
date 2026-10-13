import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { getPathname } from "@/i18n/navigation";
import { pageSize } from "@/lib/page-size";
import { siteRoutes } from "@/lib/site";

/** Who a conversation is with. */
export const conversationKinds = ["talent", "solution", "program"] as const;

export type ConversationKind = (typeof conversationKinds)[number];

/** The two lists of the screen. */
export const messagingTabs = ["chats", "requests"] as const;

export type MessagingTab = (typeof messagingTabs)[number];

/**
 * What the Messages screen shows, as the URL holds it: `?c=` the conversation that is open, `?to=`
 * and `?at=` the profile, solution or program a first message is being written to, `?tab=` the list.
 */
export const messagingSearch = {
  c: parseAsString,
  to: parseAsStringLiteral(conversationKinds),
  at: parseAsString,
  tab: parseAsStringLiteral(messagingTabs).withDefault("chats"),
};

export const loadMessagingSearch = createLoader(messagingSearch);

/** The profile, solution or program a first message goes to, by its public address. */
export type MessagingTarget = { kind: ConversationKind; slug: string };

/** Where Contact leads: Messages, with the first message to this profile, solution or program to write. */
export function messagesToRoute(kind: ConversationKind, slug: string) {
  return `${siteRoutes.messages}?to=${kind}&at=${encodeURIComponent(slug)}`;
}

/**
 * Where Contact leads for the person who reads the page: Messages for someone signed in; for a
 * visitor the sign-in screen, which returns them to the same first message.
 */
export function contactRoute(target: MessagingTarget, signedIn: boolean, locale: string) {
  const messages = messagesToRoute(target.kind, target.slug);
  if (signedIn) {
    return messages;
  }
  const returnTo = getPathname({ href: messages, locale });
  return `${siteRoutes.signIn}?${new URLSearchParams({ returnTo })}`;
}

/** Which page of the reported first messages operators read, as the URL holds it: `?page=&size=`. */
export const reportedRequestsSearch = { page: parseAsInteger.withDefault(1), size: pageSize };

export const loadReportedRequestsSearch = createLoader(reportedRequestsSearch);
