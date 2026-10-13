import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { MessagesPage } from "@/features/messaging/messages-page";
import {
  readConversation,
  readConversations,
  readProspect,
} from "@/features/messaging/messaging-queries";
import { loadMessagingSearch, messagesToRoute } from "@/features/messaging/messaging-search";
import { requireAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/workspace/messages">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Messaging" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function MessagesRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/workspace/messages">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await loadMessagingSearch(searchParams);
  // `?to=` and `?at=` name who a first message goes to; a visitor comes back to it after signing in.
  const target = search.to && search.at ? { kind: search.to, slug: search.at } : null;
  await requireAccount(target ? messagesToRoute(target.kind, target.slug) : siteRoutes.messages);
  const [list, detail, prospect] = await Promise.all([
    readConversations(),
    search.c ? readConversation(search.c) : null,
    target && !search.c ? readProspect(target) : null,
  ]);

  return <MessagesPage list={list} detail={detail} target={target} prospect={prospect} />;
}
