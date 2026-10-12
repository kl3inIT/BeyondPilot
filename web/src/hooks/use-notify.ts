"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { failureKey, type FailureWords } from "@/lib/api/failure";

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
  const translate = useTranslations();
  // The key is checked where a caller names it; here it is one of many, so the call is not re-checked.
  const say = translate as (key: MessageKey, values?: MessageValues) => string;
  const has = translate.has as (key: MessageKey) => boolean;

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
    /**
     * Says why a request failed: the words of its code, or the screen's own where it gives some
     * (docs/conventions.md › API errors).
     */
    failure(error: unknown, words?: FailureWords) {
      toast.error(say(failureKey(error, has, words)));
    },
  };
}

/**
 * The words for a failed request as text, for a failure a screen shows in place: at a field, or above
 * a form. A toast is `useNotify().failure`.
 */
function useFailureWords() {
  const translate = useTranslations();

  return useCallback(
    (error: unknown, words?: FailureWords) =>
      (translate as (key: MessageKey) => string)(
        failureKey(error, translate.has as (key: MessageKey) => boolean, words),
      ),
    [translate],
  );
}

export { useFailureWords, useNotify, type MessageKey };
