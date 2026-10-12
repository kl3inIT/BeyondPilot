import { z } from "zod";

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
