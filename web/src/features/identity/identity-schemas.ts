import { z } from "zod";

import type { ContactRequest, Me } from "@/lib/api/generated";

/** The longest name the backend takes. */
export const MAX_NAME = 120;

/** A number as the backend takes it: digits with spaces, brackets, dots or dashes, and a leading plus. */
const PHONE = /^\+?[0-9 ().-]*$/;

/** A person's contact as the account form holds it: every field as text, so none is uncontrolled. */
export type ContactValues = { name: string; country: string; phone: string };

/** What the form starts from: what the account keeps. */
export function contactValuesOf(account: Me): ContactValues {
  return {
    name: account.displayName ?? "",
    country: account.country ?? "",
    phone: account.phone ?? "",
  };
}

/**
 * What the account form checks: a name, since the backend keeps the old one when it gets none, and
 * a phone number written in digits. The country and the number may stay empty.
 */
export function contactSchema(say: (key: "nameRequired" | "phoneInvalid") => string) {
  return z.object({
    name: z.string().trim().min(1, say("nameRequired")).max(MAX_NAME),
    country: z.string(),
    phone: z.string().trim().regex(PHONE, say("phoneInvalid")),
  });
}

/** The contact the backend takes, from values the schema passed; an empty country or number is cleared. */
export function contactBodyOf(values: ContactValues): ContactRequest {
  return {
    name: values.name.trim(),
    country: values.country || null,
    phone: values.phone.trim() || null,
  };
}
