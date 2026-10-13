"use client";

import { MessagesSquareIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryStates } from "nuqs";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { siteRoutes } from "@/lib/site";
import { cn } from "cn";

import { ConversationDetails } from "./conversation-details";
import { ConversationList, type ConversationListHandle } from "./conversation-list";
import { Composer, ConversationThread } from "./conversation-thread";
import type { ProspectRead } from "./messaging-queries";
import { messagingSearch, type MessagingTab, type MessagingTarget } from "./messaging-search";
import { unreadOf } from "./messaging-state";
import { ThreadHeader } from "./thread-header";
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
 * it is about beside it.
 *
 * The address holds which conversation is open (`?c=`), and the screen follows it: the browser's
 * Back and Forward, and a link to Messages, open and close a conversation as the list does. On a
 * phone, where the list and the conversation take turns, Back therefore returns to the list. When
 * the two swap, the focus goes with what the reader sees.
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
  const openId = thread?.conversation.id ?? null;
  const canWrite = thread?.conversation.canWrite ?? false;
  // A first message is being written while the address names who it goes to and no conversation.
  const writing = target !== null && search.to !== null && search.c === null ? prospect : null;
  const active = thread !== null || writing !== null;

  /**
   * The conversation the address named when the screen last looked. What the screen writes there
   * itself names the conversation it already shows, so following it changes nothing.
   */
  const followed = useRef(search.c);
  const follow = useEffectEvent(async (c: string | null) => {
    if (c === null) {
      // Also when nothing is shown yet: a conversation still being read must not open afterwards.
      messaging.close();
      return;
    }
    if (c !== openId && (await messaging.open(c)) === "failed") {
      // The address names a conversation that cannot be shown: it says again what is shown.
      void setSearch({ c: openId }, { history: "replace" });
    }
  });
  useEffect(() => {
    if (search.c !== followed.current) {
      followed.current = search.c;
      void follow(search.c);
    }
  }, [search.c]);

  const conversations = useRef<ConversationListHandle>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  /** What the middle of the screen showed before, to tell a swap from a conversation that changed. */
  const pane = useRef({ openId, canWrite });
  useEffect(() => {
    const was = pane.current;
    pane.current = { openId, canWrite };
    if (openId !== was.openId) {
      if (openId === null) {
        conversations.current?.focus(was.openId);
      } else {
        (composer.current ?? heading.current)?.focus();
      }
    } else if (canWrite && !was.canWrite) {
      // The reader accepted it: the answers they chose from made way for the composer.
      composer.current?.focus();
    }
  }, [openId, canWrite]);

  async function open(id: string) {
    if (id !== openId && (await messaging.open(id)) === "opened") {
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
            ref={conversations}
            chats={state.chats}
            requests={state.requests}
            unread={unreadOf(state)}
            tab={search.tab}
            onTab={(tab: MessagingTab) => void setSearch({ tab })}
            openId={openId}
            onOpen={(id) => void open(id)}
          />
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", active ? "flex" : "hidden")}>
          {thread ? (
            <ConversationThread
              key={thread.conversation.id}
              thread={thread}
              connected={messaging.connected}
              headingRef={heading}
              composerRef={composer}
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
                    // The reader may have gone to another conversation meanwhile; that one stays.
                    if (await messaging.refuse(how)) {
                      void setSearch({ c: null });
                    }
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
              onSend={async (body, messageId) => {
                const id = await messaging.start(target, body, messageId);
                void setSearch({ c: id, to: null, at: null }, { history: "replace" });
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
 * and the composer. A reader who may not write there is told why instead, and what to do about it
 * where there is something to do.
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
  onSend: (body: string, id: string) => Promise<void>;
}) {
  const t = useTranslations("Messaging");
  const words = useTranslations();
  /** The identifier each text was first sent under, so sending it again after a failure writes it once. */
  const ids = useRef(new Map<string, string>());
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
      <ThreadHeader
        name={name}
        about={prospect && { kind: prospect.subject.kind, name: prospect.subject.name }}
        onBack={onBack}
      />
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
          {read.refusal === "MESSAGING_NEEDS_ORGANIZATION" && (
            <EmptyContent>
              <Button href={siteRoutes.workspaceOrganization}>{t("first.organization")}</Button>
            </EmptyContent>
          )}
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
            <Alert role="note">
              <AlertTitle>{t("first.beforeTitle")}</AlertTitle>
              <AlertDescription>
                {t(prospect.request ? "first.before" : "first.beforeOpen", { name })}
              </AlertDescription>
            </Alert>
            <Marker>
              <MarkerContent>
                {t(prospect.request ? "first.request" : "first.open", { name })}
              </MarkerContent>
            </Marker>
          </div>
          <div className="border-t px-4 py-3 md:px-6">
            <Composer
              label={t("first.label", { name })}
              onSend={(body) => {
                const id = ids.current.get(body) ?? crypto.randomUUID();
                ids.current.set(body, id);
                return onSend(body, id).then(
                  () => {
                    ids.current.delete(body);
                    return true;
                  },
                  (error: unknown) => {
                    notify.failure(error);
                    return false;
                  },
                );
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export { MessagesPage };
