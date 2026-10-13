"use client";

import { ArrowLeftIcon, MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Marker, MarkerContent } from "@/components/ui/marker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import type {
  ConversationDetail,
  ConversationList as Conversations,
  ConversationProspect,
} from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";
import { cn } from "cn";

import { ConversationDetails } from "./conversation-details";
import { ConversationList } from "./conversation-list";
import { Composer, ConversationThread } from "./conversation-thread";
import type { ProspectRead } from "./messaging-queries";
import { messagingSearch, type MessagingTab, type MessagingTarget } from "./messaging-search";
import { unreadOf } from "./messaging-state";
import { useMessaging } from "./use-messaging";

type MessagesPageProps = {
  list: Conversations;
  /** The conversation the address names, when the reader has it. */
  detail: ConversationDetail | null;
  /** The profile, solution or program the address means to write to, and what the backend said of it. */
  target: MessagingTarget | null;
  prospect: ProspectRead | null;
};

/**
 * Messages: the reader's conversations on one side, the one that is open in the middle, and what
 * it is about beside it. The address holds which conversation is open, so the browser's Back
 * returns to the list on a phone, where the list and the conversation take turns.
 */
function MessagesPage({ list, detail, target, prospect }: MessagesPageProps) {
  const t = useTranslations("Messaging");
  const notify = useNotify();
  const [search, setSearch] = useQueryStates(messagingSearch, { history: "push" });
  const [detailsOpen, setDetailsOpen] = useState(false);
  const messaging = useMessaging(
    list,
    detail,
    (error) => notify.failure(error),
    () => void setSearch({ c: null }),
  );
  const { state } = messaging;
  const thread = state.thread;
  // A first message is being written while the address names who it goes to and no conversation.
  const writing = target !== null && search.to !== null && search.c === null ? prospect : null;
  const active = thread !== null || writing !== null;

  async function open(id: string) {
    if (await messaging.open(id)) {
      void setSearch({ c: id, to: null, at: null });
    }
  }

  function back() {
    messaging.close();
    void setSearch({ c: null, to: null, at: null });
  }

  async function answer(action: () => Promise<void>, done?: MessageKey) {
    try {
      await action();
      if (done) {
        notify.success(done);
      }
    } catch (error) {
      notify.failure(error);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-0 md:p-4 lg:p-6">
      <div className="flex min-h-0 flex-1 overflow-hidden border-y bg-card md:rounded-xl md:border md:shadow-sm">
        <div
          className={cn(
            "min-h-0 w-full flex-col border-r lg:flex lg:w-88 lg:shrink-0",
            active ? "hidden" : "flex",
          )}
        >
          <ConversationList
            chats={state.chats}
            requests={state.requests}
            unread={unreadOf(state)}
            tab={search.tab}
            onTab={(tab: MessagingTab) => void setSearch({ tab })}
            openId={thread?.conversation.id ?? null}
            onOpen={(id) => void open(id)}
          />
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", active ? "flex" : "hidden")}>
          {thread ? (
            <ConversationThread
              thread={thread}
              connected={messaging.connected}
              onBack={back}
              onDetails={() => setDetailsOpen(true)}
              onSend={messaging.send}
              onRetry={messaging.retry}
              onTyping={messaging.typing}
              onEarlier={messaging.earlier}
              onAccept={() => answer(messaging.accept, "Messaging.answer.accepted")}
              onRefuse={(how) =>
                answer(
                  async () => {
                    await messaging.refuse(how);
                    void setSearch({ c: null });
                  },
                  how === "report" ? "Messaging.answer.reported" : "Messaging.answer.declined",
                )
              }
            />
          ) : writing && target ? (
            <FirstMessage
              read={writing}
              onBack={back}
              onOpen={(id) => void open(id)}
              onSend={async (body) => {
                const id = await messaging.start(target, body);
                void setSearch({ c: id, to: null, at: null });
              }}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MessagesSquareIcon aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>{t("choose.title")}</EmptyTitle>
                <EmptyDescription>{t("choose.lead")}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button prominence="secondary" href={siteRoutes.solutions}>
                    {t("choose.solutions")}
                  </Button>
                  <Button prominence="secondary" href={siteRoutes.talent}>
                    {t("choose.talent")}
                  </Button>
                </div>
              </EmptyContent>
            </Empty>
          )}
        </div>
        {thread && (
          <aside
            aria-label={t("details.title")}
            className="hidden w-80 shrink-0 overflow-y-auto border-l xl:block"
          >
            <ConversationDetails
              subject={thread.subject}
              participants={thread.participants}
              side={thread.conversation.side}
            />
          </aside>
        )}
        {writing?.prospect && (
          <aside
            aria-label={t("details.title")}
            className="hidden w-80 shrink-0 overflow-y-auto border-l xl:block"
          >
            <ConversationDetails
              subject={writing.prospect.subject}
              participants={writing.prospect.participants}
              side="starter"
            />
          </aside>
        )}
      </div>
      {thread && (
        <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
          <SheetContent closeLabel={t("details.close")}>
            <SheetHeader>
              <SheetTitle>{t("details.title")}</SheetTitle>
              <SheetDescription className="sr-only">{t("details.lead")}</SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ConversationDetails
                subject={thread.subject}
                participants={thread.participants}
                side={thread.conversation.side}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

/**
 * The first message to someone the reader has not written to: who reads it, what becomes of it,
 * and the composer. A reader who may not write there is told why instead.
 */
function FirstMessage({
  read,
  onBack,
  onOpen,
  onSend,
}: {
  read: ProspectRead;
  onBack: () => void;
  onOpen: (id: string) => void;
  onSend: (body: string) => Promise<void>;
}) {
  const t = useTranslations("Messaging");
  const words = useTranslations();
  const notify = useNotify();
  const prospect: ConversationProspect | undefined = read.prospect;
  // The words of the code the backend refused with, when the catalog the reader was sent has them.
  const refusal = `Errors.${read.refusal ?? "unknown"}` as MessageKey;
  const name = prospect
    ? (prospect.counterpartName ??
      (prospect.subject.kind === "program" ? t("genaiFund") : prospect.subject.name))
    : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-3 md:px-6">
        <IconButton
          prominence="tertiary"
          size="sm"
          className="lg:hidden"
          aria-label={t("thread.back")}
          onClick={onBack}
        >
          <ArrowLeftIcon aria-hidden="true" />
        </IconButton>
        {name && (
          <Avatar>
            <AvatarFallback>{initials(name, name)}</AvatarFallback>
          </Avatar>
        )}
        <div className="grid min-w-0 flex-1 text-sm">
          <h2 className="truncate font-medium">{name ?? t("first.refusedTitle")}</h2>
          {prospect && (
            <p className="truncate text-muted-foreground">
              {[t(`kind.${prospect.subject.kind}`), prospect.subject.name]
                .filter((part) => part !== name)
                .join(" · ")}
            </p>
          )}
        </div>
      </header>
      {!prospect || !name ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("first.refusedTitle")}</EmptyTitle>
            <EmptyDescription>
              {(words.has as (key: MessageKey) => boolean)(refusal)
                ? (words as (key: MessageKey) => string)(refusal)
                : t("first.refused")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : prospect.conversationId ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("first.existsTitle", { name })}</EmptyTitle>
            <EmptyDescription>{t("first.existsLead")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => onOpen(prospect.conversationId as string)}>
              {t("first.openExisting")}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto p-4 md:p-6">
            <div className="rounded-lg border bg-muted p-3 text-sm">
              <p className="text-xs text-muted-foreground">{t("first.beforeTitle")}</p>
              <p>{t(prospect.request ? "first.before" : "first.beforeOpen", { name })}</p>
            </div>
            <Marker>
              <MarkerContent>
                {t(prospect.request ? "first.request" : "first.open", { name })}
              </MarkerContent>
            </Marker>
          </div>
          <div className="border-t px-4 py-3 md:px-6">
            <Composer
              label={t("first.label", { name })}
              onSend={(body) =>
                onSend(body).then(
                  () => true,
                  (error: unknown) => {
                    notify.failure(error);
                    return false;
                  },
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

export { MessagesPage };
