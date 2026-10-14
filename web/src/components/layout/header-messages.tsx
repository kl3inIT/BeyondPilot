"use client";

import { MessageCircleMoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadMessages } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/** Refresh counts without opening a conversation stream on every public page. */
const REFRESH_MS = 10_000;

function HeaderMessages({ waiting }: { waiting: number }) {
  const t = useTranslations("Site.account");
  const [count, setCount] = useState(waiting);

  useEffect(() => {
    let gone = false;
    let pending = false;
    const controller = new AbortController();
    async function refresh() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const { data } = await getUnreadMessages({
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]),
        });
        if (!gone) setCount(data.unread + data.requests);
      } catch {
        // Keep the last known count until the next successful refresh.
      } finally {
        pending = false;
      }
    }
    const update = () => void refresh();
    update();
    const timer = window.setInterval(update, REFRESH_MS);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      gone = true;
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [waiting]);

  return (
    <Button
      prominence="tertiary"
      href={siteRoutes.messages}
      aria-label={
        count > 0 ? `${t("messages")}, ${t("messagesWaiting", { count })}` : t("messages")
      }
      className="hit-area relative size-9 shrink-0 rounded-full px-0"
    >
      <MessageCircleMoreIcon aria-hidden="true" className="size-6" />
      {count > 0 && (
        <Badge
          variant="notification"
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1"
        >
          {count}
        </Badge>
      )}
    </Button>
  );
}

export { HeaderMessages };
