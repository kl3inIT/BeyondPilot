"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

type MessageKey = Parameters<ReturnType<typeof useTranslations<never>>>[0];
type MessageValues = Record<string, string | number>;
type NotifyOptions = {
  /**
   * The inverse of what the toast reports. Given, the toast offers Undo for as long as it stays, and
   * a click calls this. Only for an action that can be restored and tells nobody outside
   * (docs/conventions.md › Actions); the inverse raises its own toast, without an Undo.
   */
  undo?: () => void;
};

/**
 * Raises a toast from a message key, never from text: a toast is always in the reader's language,
 * and nothing a backend sent is shown as it came (docs/conventions.md › Errors, loading and empty
 * states).
 */
function useNotify() {
  // The key is checked where a caller names it; here it is one of many, so the call is not re-checked.
  const say = useTranslations() as (key: MessageKey, values?: MessageValues) => string;

  return {
    success(key: MessageKey, values?: MessageValues, options?: NotifyOptions) {
      const undo = options?.undo;
      toast.success(
        say(key, values),
        undo && { action: { label: say("Actions.undo"), onClick: undo } },
      );
    },
    error(key: MessageKey, values?: MessageValues) {
      toast.error(say(key, values));
    },
  };
}

export { useNotify, type MessageKey };
