import { z } from "zod";

import type { HeldDeck, HeldImage, ReviewField, SolutionDraft } from "./solution-editor-state";

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
    listed: z.boolean(),
  }) satisfies z.ZodType<SolutionDraft>;
}
