import { createLoader, parseAsString, parseAsStringLiteral } from "nuqs/server";

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
