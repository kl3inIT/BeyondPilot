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

/** A web address an operator types: the backend takes `http` and `https` ones. */
const webAddress = /^https?:\/\/\S+$/;

/** The words the Settings schemas are written in. */
type SaySettings = (
  key:
    | "required"
    | "tooLong"
    | "slugFormat"
    | "slugLength"
    | "endsBeforeStarts"
    | "closesBeforeOpens"
    | "outcomesBeforeClose"
    | "webAddress"
    | "positive",
  values?: { max: number },
) => string;

/** A key date as its dialog holds it: a day, and either the whole day or a time from and to. */
export type KeyDateValue = {
  title: string;
  day: string;
  from: string;
  to: string;
  allDay: boolean;
  note: string;
};

/** An event as its dialog holds it. */
export type EventValue = {
  title: string;
  startsDay: string;
  startsTime: string;
  endsDay: string;
  endsTime: string;
  online: boolean;
  city: string;
  country: string;
  registrationUrl: string;
};

/** A program as Settings holds it: what the inputs show, days and times in Vietnam. */
export type SettingsValues = {
  version: number;
  name: string;
  slug: string;
  type: ProgramType;
  partnerName: string;
  summary: string;
  about: string;
  startsOn: string;
  endsOn: string;
  pageKind: AdminProgram["pageKind"];
  externalUrl: string;
  coverFileId: string;
  takesApplications: boolean;
  opensDay: string;
  opensTime: string;
  closesDay: string;
  closesTime: string;
  shortlistSize: string;
  outcomesDueOn: string;
  allowUpdatesUntilClose: boolean;
  keyDates: KeyDateValue[];
  events: EventValue[];
};

const text = (max: number, say: SaySettings) => z.string().max(max, say("tooLong", { max }));

export function keyDateSchema(say: SaySettings) {
  return z
    .object({
      title: text(160, say).trim().min(1, say("required")),
      day: z.string().min(1, say("required")),
      from: z.string(),
      to: z.string(),
      allDay: z.boolean(),
      note: text(500, say),
    })
    .superRefine((value, context) => {
      if (!value.allDay && !value.from) {
        context.addIssue({ code: "custom", path: ["from"], message: say("required") });
      }
      if (!value.allDay && value.from && value.to && value.to < value.from) {
        context.addIssue({ code: "custom", path: ["to"], message: say("endsBeforeStarts") });
      }
    });
}

export function eventSchema(say: SaySettings) {
  return z
    .object({
      title: text(160, say).trim().min(1, say("required")),
      startsDay: z.string().min(1, say("required")),
      startsTime: z.string().min(1, say("required")),
      endsDay: z.string(),
      endsTime: z.string(),
      online: z.boolean(),
      city: text(80, say),
      country: text(80, say),
      registrationUrl: text(2000, say).refine(
        (value) => value === "" || webAddress.test(value),
        say("webAddress"),
      ),
    })
    .superRefine((value, context) => {
      if (value.endsDay && value.endsTime) {
        const starts = `${value.startsDay}T${value.startsTime}`;
        if (`${value.endsDay}T${value.endsTime}` < starts) {
          context.addIssue({
            code: "custom",
            path: ["endsTime"],
            message: say("endsBeforeStarts"),
          });
        }
      }
    });
}

/** What Settings checks before it saves; the backend checks the same again. */
export function settingsSchema(say: SaySettings) {
  return z
    .object({
      version: z.number(),
      name: text(120, say).trim().min(1, say("required")),
      slug: z
        .string()
        .min(slugBounds.min, say("slugLength"))
        .max(slugBounds.max, say("slugLength"))
        .regex(slugPattern, say("slugFormat")),
      type: z.enum(programTypes),
      partnerName: text(120, say),
      summary: text(300, say),
      about: text(20000, say),
      startsOn: z.string(),
      endsOn: z.string(),
      pageKind: z.enum(["standard", "custom", "external"]),
      externalUrl: text(2000, say).refine(
        (value) => value === "" || webAddress.test(value),
        say("webAddress"),
      ),
      coverFileId: z.string(),
      takesApplications: z.boolean(),
      opensDay: z.string(),
      opensTime: z.string(),
      closesDay: z.string(),
      closesTime: z.string(),
      shortlistSize: z
        .string()
        .refine((value) => value === "" || /^[1-9]\d*$/.test(value), say("positive")),
      outcomesDueOn: z.string(),
      allowUpdatesUntilClose: z.boolean(),
      keyDates: z.array(z.custom<KeyDateValue>()).max(30),
      events: z.array(z.custom<EventValue>()).max(30),
    })
    .superRefine((value, context) => {
      const issue = (path: string, message: string) =>
        context.addIssue({ code: "custom", path: [path], message });
      if (value.startsOn && value.endsOn && value.endsOn < value.startsOn) {
        issue("endsOn", say("endsBeforeStarts"));
      }
      if (value.pageKind === "external" && value.externalUrl.trim() === "") {
        issue("externalUrl", say("required"));
      }
      if (value.takesApplications) {
        for (const field of ["opensDay", "opensTime", "closesDay", "closesTime"] as const) {
          if (!value[field]) {
            issue(field, say("required"));
          }
        }
        const opens = `${value.opensDay}T${value.opensTime}`;
        const closes = `${value.closesDay}T${value.closesTime}`;
        if (
          value.opensDay &&
          value.closesDay &&
          value.opensTime &&
          value.closesTime &&
          closes <= opens
        ) {
          issue("closesDay", say("closesBeforeOpens"));
        }
        if (value.outcomesDueOn && value.closesDay && value.outcomesDueOn < value.closesDay) {
          issue("outcomesDueOn", say("outcomesBeforeClose"));
        }
      }
    });
}
