import { z } from "zod";

import type { Offer } from "@/lib/api/generated";

import type { HeldDeck, HeldImage, ReviewField, SolutionDraft } from "./solution-editor-state";

/** The limits the backend sets on an offer, repeated so a person meets them before a round trip. */
export const offerLimits = { title: 80, url: 2048 } as const;

/** The words a schema's messages are written in; the form passes its translators. */
type Say = (key: "required" | "tooLong", values?: { max: number }) => string;

/**
 * An offer as its form holds it: the line a card says, and the address where it is claimed. The
 * address is an https one and no other, since a card links to it straight away.
 */
export function offerSchema(say: Say, addressInvalid: string) {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, say("required"))
      .max(offerLimits.title, say("tooLong", { max: offerLimits.title })),
    url: z
      .string()
      .trim()
      .min(1, say("required"))
      .max(offerLimits.url, say("tooLong", { max: offerLimits.url }))
      .regex(/^https:\/\/\S+$/, addressInvalid),
  });
}

/**
 * A link of a solution, which the backend takes only as a full `http(s)` address. An empty link is
 * no link, which is fine.
 */
export function linkSchema(invalid?: string) {
  return z.string().refine((text) => {
    const value = text.trim();
    return value === "" || /^https?:\/\/\S+$/.test(value);
  }, invalid);
}

/**
 * What the editor holds, with what a review needs of it: the name, which every save needs too, and
 * the fields the backend asks for before it takes a solution for review. `say` words each of them.
 */
export function draftSchema(say: (key: `needed.${ReviewField}`) => string) {
  const filled = (text: string) => text.trim() !== "";
  return z.object({
    name: z.string().refine(filled, say("needed.name")),
    summary: z.string().refine(filled, say("needed.summary")),
    problemsSolved: z.string(),
    valueProposition: z.string(),
    maturity: z.string().refine(filled, say("needed.maturity")),
    traction: z.string(),
    builtWith: z.array(z.string()),
    industries: z.array(z.string()).min(1, say("needed.industries")),
    focusAreas: z.array(z.string()).min(1, say("needed.focusAreas")),
    languages: z.array(z.string()),
    deployment: z.array(z.string()),
    channels: z.string(),
    bestCustomerProfile: z.string(),
    website: z.string(),
    demoUrl: z.string(),
    deck: z.custom<HeldDeck | null>(),
    logo: z.custom<HeldImage | null>().refine((image) => image !== null, say("needed.logo")),
    cover: z.custom<HeldImage | null>().refine((image) => image !== null, say("needed.cover")),
    images: z.custom<HeldImage[]>(),
    offers: z.custom<Offer[]>(),
    listed: z.boolean(),
  }) satisfies z.ZodType<SolutionDraft>;
}
