import type { Messages } from "next-intl";

import type { MessageKey } from "@/hooks/use-notify";

import { ApiError } from "./client";

/**
 * A failure code the catalog has words for, under `Errors.<CODE>`. A code named in the web is checked
 * against this, so a misspelt one, or one whose words were removed, does not compile.
 */
type ErrorCode = Exclude<keyof Messages["Errors"], "unknown">;

/**
 * What one screen says differently from the catalog: its own words for a code, where the general ones
 * would mislead there, and `otherwise`, what did not happen, for a failure that has no words of its own.
 */
type FailureWords = Partial<Record<ErrorCode, MessageKey>> & { otherwise?: MessageKey };

/** The code of a refused request; nothing for a request that got no answer, or a failure of another kind. */
function codeOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}

/**
 * Whether the request was refused with one of these codes, and which. For a screen that does
 * something else on a refusal, such as showing it at a field; choosing words is `failureKey`'s.
 */
function failedWith<Code extends ErrorCode>(error: unknown, ...codes: Code[]): Code | undefined {
  const code = codeOf(error);
  return codes.find((candidate) => candidate === code);
}

/**
 * The message for a failed request (docs/conventions.md › API errors): the screen's own words for its
 * code, else the code's words in the catalog, else what the screen says did not happen, else the
 * general words. `has` says whether the catalog the reader was sent holds a message, so a code newer
 * than the catalog, or one of an area that was not sent, gets the fallback and never a bare key.
 */
function failureKey(
  error: unknown,
  has: (key: MessageKey) => boolean,
  words: FailureWords = {},
): MessageKey {
  const code = codeOf(error);
  if (code !== undefined) {
    const own = Object.hasOwn(words, code) ? words[code as ErrorCode] : undefined;
    if (own !== undefined) {
      return own;
    }
    const general = `Errors.${code}` as MessageKey;
    if (has(general)) {
      return general;
    }
  }
  return words.otherwise ?? "Errors.unknown";
}

export { codeOf, failedWith, failureKey, type ErrorCode, type FailureWords };
