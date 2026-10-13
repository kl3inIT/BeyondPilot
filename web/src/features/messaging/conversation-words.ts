import { useTranslations } from "next-intl";

import { useFormatter } from "@/i18n/format";
import type { Conversation } from "@/lib/api/generated";

/** The day of a moment in Vietnam time, as a string two moments of one day share. */
function dayOf(format: ReturnType<typeof useFormatter>, at: Date) {
  return format.dateTime(at, "date");
}

/**
 * The words a conversation is shown with wherever it appears: who the other side is, and when
 * something was written, as a list and a conversation each say it.
 */
function useConversationWords() {
  const t = useTranslations("Messaging");
  const format = useFormatter();

  return {
    /** The other side by name: GenAI Fund for a program, "Someone" for a person who gave no name. */
    nameOf(conversation: Pick<Conversation, "counterpartName" | "kind" | "side">) {
      if (conversation.counterpartName) {
        return conversation.counterpartName;
      }
      return conversation.kind === "program" && conversation.side === "starter"
        ? t("genaiFund")
        : t("someone");
    },
    /** The time for a moment of today, the day for an earlier one. */
    rowTime(at: string) {
      const moment = new Date(at);
      return dayOf(format, moment) === dayOf(format, new Date())
        ? format.dateTime(moment, "time")
        : format.dateTime(moment, "day");
    },
    /** The day a message was written, by its name when it is today or yesterday. */
    dayName(at: string) {
      const day = dayOf(format, new Date(at));
      const now = new Date();
      if (day === dayOf(format, now)) {
        return t("thread.today");
      }
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      return day === dayOf(format, yesterday) ? t("thread.yesterday") : day;
    },
    /** Whether two moments fall on one day. */
    sameDay(a: string, b: string) {
      return dayOf(format, new Date(a)) === dayOf(format, new Date(b));
    },
    time(at: string) {
      return format.dateTime(new Date(at), "time");
    },
    date(at: string) {
      return format.dateTime(new Date(at), "date");
    },
  };
}

export { useConversationWords };
