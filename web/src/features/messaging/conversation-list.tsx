"use client";

import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Conversation } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { cn } from "cn";

import { useConversationWords } from "./conversation-words";
import { messagingTabs, type MessagingTab } from "./messaging-search";

type ConversationListProps = {
  chats: Conversation[];
  requests: Conversation[];
  /** How many messages the reader has not read across the open conversations. */
  unread: number;
  tab: MessagingTab;
  onTab: (tab: MessagingTab) => void;
  /** The conversation that is open, if one is. */
  openId: string | null;
  onOpen: (id: string) => void;
};

/**
 * The reader's conversations: the title, a search by name, the two lists, and one row a
 * conversation with its last message. The one written in last comes first; a conversation with
 * messages the reader has not read says how many, in bold.
 */
function ConversationList({
  chats,
  requests,
  unread,
  tab,
  onTab,
  openId,
  onOpen,
}: ConversationListProps) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const [query, setQuery] = useState("");
  const all = tab === "requests" ? requests : chats;
  const wanted = query.trim().toLocaleLowerCase();
  const rows = wanted
    ? all.filter((row) =>
        [words.nameOf(row), row.subjectName, row.counterpartOrganization ?? ""].some((text) =>
          text.toLocaleLowerCase().includes(wanted),
        ),
      )
    : all;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-3 px-4 pt-4 md:px-5 md:pt-5">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
        <Tabs value={tab} onValueChange={(value) => onTab(value as MessagingTab)}>
          <TabsList variant="underline" aria-label={t("tabs.label")}>
            {messagingTabs.map((value) => {
              const count = value === "chats" ? unread : requests.length;
              return (
                <TabsTrigger key={value} value={value}>
                  {t(`tabs.${value}`)}
                  {count > 0 && (
                    <span className="text-xs text-primary tabular-nums">
                      <span aria-hidden="true">{count}</span>
                      <span className="sr-only">{t(`tabs.${value}Count`, { count })}</span>
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{t(wanted ? "list.none.title" : `list.empty.${tab}.title`)}</EmptyTitle>
              <EmptyDescription>
                {t(wanted ? "list.none.lead" : `list.empty.${tab}.lead`)}
              </EmptyDescription>
            </EmptyHeader>
            {wanted && <TextButton onClick={() => setQuery("")}>{t("list.none.clear")}</TextButton>}
          </Empty>
        ) : (
          <ItemGroup aria-label={t(`tabs.${tab}`)}>
            {rows.map((row) => (
              <div key={row.id} role="listitem">
                <ConversationRow row={row} active={row.id === openId} onOpen={onOpen} />
              </div>
            ))}
          </ItemGroup>
        )}
      </div>
    </div>
  );
}

/** One conversation of the list: who it is with, its last message, when, and what waits in it. */
function ConversationRow({
  row,
  active,
  onOpen,
}: {
  row: Conversation;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("Messaging");
  const words = useConversationWords();
  const name = words.nameOf(row);
  const last = row.lastMessage;
  const unread = row.unread > 0;
  const waitsForReader = row.side === "recipient" && row.status === "pending";
  const preview = !last
    ? ""
    : last.mine
      ? t("row.you", { text: last.preview })
      : row.kind !== "talent" && last.senderName
        ? t("row.from", { name: last.senderName, text: last.preview })
        : last.preview;

  return (
    <Item
      size="sm"
      variant={active ? "muted" : "default"}
      render={
        <button
          type="button"
          aria-current={active ? "true" : undefined}
          onClick={() => onOpen(row.id)}
        />
      }
    >
      <ItemMedia>
        <Avatar size="lg">
          <AvatarFallback>{initials(name, name)}</AvatarFallback>
        </Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          <span className={cn("truncate", (unread || waitsForReader) && "font-semibold")}>
            {name}
          </span>
          <Badge variant="outline">{t(`kind.${row.kind}`)}</Badge>
        </ItemTitle>
        <ItemDescription>
          <span className={cn((unread || waitsForReader) && "font-medium text-foreground")}>
            {preview}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <div className="flex flex-col items-end gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {words.rowTime(row.lastMessageAt)}
          </span>
          {unread && (
            <Badge>
              <span aria-hidden="true">{row.unread}</span>
              <span className="sr-only">{t("row.unread", { count: row.unread })}</span>
            </Badge>
          )}
          {waitsForReader && <Status tone="info">{t("row.new")}</Status>}
          {row.side === "starter" && row.status !== "accepted" && (
            <Status tone={row.status === "pending" ? "warning" : "neutral"}>
              {t(`row.status.${row.status}`)}
            </Status>
          )}
        </div>
      </ItemActions>
    </Item>
  );
}

export { ConversationList };
