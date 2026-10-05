import { z } from "zod";

import type { AdminProgram } from "@/lib/api/generated";

/** The ten kinds of program, in the order a person picks from them. */
export const programTypes = [
  "enterprise_challenge",
  "open_innovation_call",
  "accelerator",
  "hackathon",
  "buildathon",
  "grant",
  "venture_building",
  "pitch_competition",
  "event_series",
  "event",
] as const satisfies readonly AdminProgram["type"][];

export type ProgramType = (typeof programTypes)[number];

/** An address under /programs: lowercase letters, digits and single hyphens, as the backend accepts. */
export const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slugBounds = { min: 3, max: 60 } as const;

/**
 * An address made from a name: Vietnamese and other accents dropped, `đ` read as `d`, every run of
 * other characters a single hyphen, cut at the longest address without a trailing hyphen.
 * "AI for Insurance Challenge × Tasco" becomes `ai-for-insurance-challenge-tasco`.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, slugBounds.max)
    .replace(/-+$/, "");
}

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (
  key: "required" | "slugFormat" | "slugLength" | "tooLong",
  values?: { max: number },
) => string;

/** What New program asks for. */
export function createProgramSchema(say: Say) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, say("required"))
      .max(120, say("tooLong", { max: 120 })),
    slug: z
      .string()
      .min(slugBounds.min, say("slugLength"))
      .max(slugBounds.max, say("slugLength"))
      .regex(slugPattern, say("slugFormat")),
    type: z.enum(programTypes),
  });
}
