"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

type MessageKey = Parameters<ReturnType<typeof useTranslations<never>>>[0];
type MessageValues = Record<string, string | number>;

/**
 * Raises a toast from a message key, never from text: a toast is always in the reader's language,
 * and nothing a backend sent is shown as it came (docs/conventions.md › Errors, loading and empty
 * states).
 */
function useNotify() {
  // The key is checked where a caller names it; here it is one of many, so the call is not re-checked.
  const say = useTranslations() as (key: MessageKey, values?: MessageValues) => string;

  return {
    success(key: MessageKey, values?: MessageValues) {
      toast.success(say(key, values));
    },
    error(key: MessageKey, values?: MessageValues) {
      toast.error(say(key, values));
    },
  };
}

export { useNotify, type MessageKey };
