"use client";

import { MessageCircleMoreIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { Badge } from "@/components/ui/badge";
import { getUnreadMessages } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/**
 * How often the count is read again while the tab is in view. A number in the header need not be
 * exact to the second, and it is read again as soon as the reader comes back to the tab; the
 * Messages screen itself follows the conversation stream.
 */
const REFRESH_MS = 60_000;

/** Above this the badge says "99+", so that it keeps its size. */
const MOST_SHOWN = 99;

/**
 * The way to Messages for a signed-in person, with what waits for them: unread messages and
 * requests to answer. The count is read in the browser, so the page never waits for it, and read
 * again on a timer rather than over a stream, which would hold a connection open on every page.
 */
function HeaderMessages() {
  const t = useTranslations("Site.account");
  const [count, setCount] = useState(0);

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
  }, []);

  return (
    <Button
      prominence="tertiary"
      href={siteRoutes.messages}
      aria-label={
        count > 0 ? `${t("messages")}, ${t("messagesWaiting", { count })}` : t("messages")
      }
      className="hit-area relative size-9 shrink-0 rounded-full px-0"
    >
      <MessageCircleMoreIcon aria-hidden="true" className="size-5" />
      {count > 0 && (
        <Badge
          variant="notification"
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1"
        >
          {count > MOST_SHOWN ? `${MOST_SHOWN}+` : count}
        </Badge>
      )}
    </Button>
  );
}

export { HeaderMessages };
