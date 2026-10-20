import { z } from "zod";

import type { MyUseCase, SaveMyUseCase } from "@/lib/api/generated";
import { instantInVietnam, partsInVietnam } from "@/lib/vietnam-time";

import { timelinePresets } from "./admin-use-case-codes";
import { MAX_TEXT } from "./admin-use-case-schema";
import type { UploadedAttachment } from "./admin-use-case-attachments";
import { isCurrency, type BudgetCurrency } from "./use-case-budget";

/** One thing the solution must do, as it is written; a row may still be empty while it is typed. */
export type RequirementValue = { statement: string; necessity: "required" | "optional" };

/**
 * What the members have written, as the wizard holds it: every text as typed, numbers as typed, and the
 * close date as the day and the time it is in Vietnam. Nothing is required until the use case is sent.
 */
export type DraftValues = {
  title: string;
  problemStatement: string;
  industry: string;
  technologies: string[];
  expectedOutcomes: string;
  currentProcess: string;
  currentSolutions: string;
  targetUsers: string;
  requirements: RequirementValue[];
  dataReadiness: string;
  integrationRequirements: string;
  attachments: UploadedAttachment[];
  /** The currency the amounts are in. */
  currency: BudgetCurrency;
  budgetMin: string;
  budgetMax: string;
  budgetToBeDetermined: boolean;
  budgetMembersOnly: boolean;
  /** The weeks the use case asks for, kept as they were saved even when no preset names them. */
  timelineMinWeeks: number | null;
  timelineMaxWeeks: number | null;
  closesDay: string;
  closesTime: string;
  hideOrganizationName: boolean;
};

/** The close time a new use case starts with: the end of the day, in Vietnam. */
const defaultClosesTime = "23:59";

/** A use case before anything is written: three requirements to fill, two required and one optional. */
export const blankDraft: DraftValues = {
  title: "",
  problemStatement: "",
  industry: "",
  technologies: [],
  expectedOutcomes: "",
  currentProcess: "",
  currentSolutions: "",
  targetUsers: "",
  requirements: [
    { statement: "", necessity: "required" },
    { statement: "", necessity: "required" },
    { statement: "", necessity: "optional" },
  ],
  dataReadiness: "",
  integrationRequirements: "",
  attachments: [],
  currency: "USD",
  budgetMin: "",
  budgetMax: "",
  budgetToBeDetermined: false,
  budgetMembersOnly: false,
  timelineMinWeeks: null,
  timelineMaxWeeks: null,
  closesDay: "",
  closesTime: defaultClosesTime,
  hideOrganizationName: false,
};

/** What a use case says, as both the members and the operators read it. */
export type UseCaseContent = Pick<
  MyUseCase,
  | "title"
  | "problemStatement"
  | "industry"
  | "technologies"
  | "expectedOutcomes"
  | "currentProcess"
  | "currentSolutions"
  | "targetUsers"
  | "requirements"
  | "dataReadiness"
  | "integrationRequirements"
  | "attachments"
  | "currency"
  | "budgetMin"
  | "budgetMax"
  | "budgetToBeDetermined"
  | "budgetMembersOnly"
  | "timelineMinWeeks"
  | "timelineMaxWeeks"
  | "closesAt"
  | "hideOrganizationName"
>;

export function draftValuesOf(useCase: UseCaseContent): DraftValues {
  const closes = useCase.closesAt ? partsInVietnam(useCase.closesAt) : null;
  return {
    title: useCase.title ?? "",
    problemStatement: useCase.problemStatement ?? "",
    industry: useCase.industry ?? "",
    technologies: useCase.technologies,
    expectedOutcomes: useCase.expectedOutcomes ?? "",
    currentProcess: useCase.currentProcess ?? "",
    currentSolutions: useCase.currentSolutions ?? "",
    targetUsers: useCase.targetUsers ?? "",
    requirements: useCase.requirements,
    dataReadiness: useCase.dataReadiness ?? "",
    integrationRequirements: useCase.integrationRequirements ?? "",
    attachments: useCase.attachments.map(({ id, fileName, mediaType, sizeBytes }) => ({
      id,
      fileName,
      mediaType,
      sizeBytes,
    })),
    currency: isCurrency(useCase.currency) ? useCase.currency : "USD",
    budgetMin:
      useCase.budgetMin === null || useCase.budgetMin === undefined
        ? ""
        : String(useCase.budgetMin),
    budgetMax:
      useCase.budgetMax === null || useCase.budgetMax === undefined
        ? ""
        : String(useCase.budgetMax),
    budgetToBeDetermined: useCase.budgetToBeDetermined,
    budgetMembersOnly: useCase.budgetMembersOnly,
    timelineMinWeeks: useCase.timelineMinWeeks ?? null,
    timelineMaxWeeks: useCase.timelineMaxWeeks ?? null,
    closesDay: closes?.day ?? "",
    closesTime: closes?.time ?? defaultClosesTime,
    hideOrganizationName: useCase.hideOrganizationName,
  };
}

const orNull = (text: string) => (text.trim() === "" ? null : text);

/** A whole number typed into a field, or null while it is empty or not a number. */
function amount(text: string): number | null {
  return /^\d{1,13}$/.test(text.trim()) ? Number(text.trim()) : null;
}

/**
 * What is sent to be saved. An empty row of requirements is left out, so that typing a new one does not
 * stop the save of everything else; the budget is sent as no amount while it is to be determined.
 */
export function bodyOf(values: DraftValues, version: number): SaveMyUseCase {
  return {
    title: orNull(values.title),
    problemStatement: orNull(values.problemStatement),
    industry: orNull(values.industry),
    technologies: values.technologies as SaveMyUseCase["technologies"],
    expectedOutcomes: orNull(values.expectedOutcomes),
    currentProcess: orNull(values.currentProcess),
    currentSolutions: orNull(values.currentSolutions),
    targetUsers: orNull(values.targetUsers),
    requirements: values.requirements.filter((requirement) => requirement.statement.trim() !== ""),
    dataReadiness: orNull(values.dataReadiness),
    integrationRequirements: orNull(values.integrationRequirements),
    attachmentFileIds: values.attachments.map((file) => file.id),
    currency: values.currency,
    budgetMin: values.budgetToBeDetermined ? null : amount(values.budgetMin),
    budgetMax: values.budgetToBeDetermined ? null : amount(values.budgetMax),
    budgetToBeDetermined: values.budgetToBeDetermined,
    budgetMembersOnly: values.budgetMembersOnly,
    timelineMinWeeks: values.timelineMinWeeks,
    timelineMaxWeeks: values.timelineMaxWeeks,
    closesAt: values.closesDay ? instantInVietnam(values.closesDay, values.closesTime) : null,
    hideOrganizationName: values.hideOrganizationName,
    version,
  };
}

/** The code of the preset that names these weeks, or empty when none does. */
export function timelineOf(
  values: Pick<DraftValues, "timelineMinWeeks" | "timelineMaxWeeks">,
): string {
  const match = Object.entries(timelinePresets).find(
    ([, weeks]) => weeks.min === values.timelineMinWeeks && weeks.max === values.timelineMaxWeeks,
  );
  return match ? match[0] : "";
}

/** The steps of the wizard, in order. The last one reviews the others. */
export const steps = ["challenge", "outcomes", "requirements", "budget", "review"] as const;
export type Step = (typeof steps)[number];

/** The steps that still lack something a use case needs before it is sent, in the order of the wizard. */
export function incompleteSteps(values: DraftValues): Step[] {
  const missing: Step[] = [];
  const has = (text: string) => text.trim() !== "";
  if (
    !has(values.title) ||
    !has(values.problemStatement) ||
    !has(values.industry) ||
    values.technologies.length === 0
  ) {
    missing.push("challenge");
  }
  if (!has(values.expectedOutcomes) || !has(values.currentProcess) || !has(values.targetUsers)) {
    missing.push("outcomes");
  }
  if (
    !values.requirements.some((requirement) => has(requirement.statement)) ||
    !has(values.dataReadiness) ||
    !has(values.integrationRequirements)
  ) {
    missing.push("requirements");
  }
  const budgetKnown =
    values.budgetToBeDetermined ||
    (amount(values.budgetMin) !== null && amount(values.budgetMax) !== null);
  if (
    !budgetKnown ||
    values.timelineMinWeeks === null ||
    values.timelineMaxWeeks === null ||
    values.closesDay === ""
  ) {
    missing.push("budget");
  }
  return missing;
}

/** The most requirements a use case holds, as the backend takes it. */
export const MAX_REQUIREMENTS = 30;

/** The words the draft's checks are written in; the wizard passes its translators. */
type DraftSay = {
  tooLong: (max: number) => string;
  budgetOutOfOrder: string;
  closesInPast: string;
};

/** The day it is in Vietnam at that instant, as the date input writes it. */
function dayInVietnam(at: number) {
  return partsInVietnam(new Date(at).toISOString()).day;
}

/**
 * What a draft may not hold even while parts are missing, beyond what each field checks itself
 * (an amount that is not a whole number, a close day already past): text past its limit, a
 * maximum below the minimum, a close time today that has already gone. The backend refuses each.
 */
export function draftSchema(say: DraftSay, now: () => number = Date.now) {
  const text = (max: number) => z.string().max(max, say.tooLong(max));
  // Loose: the parts it does not check pass as they are.
  return z
    .looseObject({
      title: text(200),
      problemStatement: text(MAX_TEXT),
      expectedOutcomes: text(MAX_TEXT),
      currentProcess: text(MAX_TEXT),
      currentSolutions: text(MAX_TEXT),
      targetUsers: text(MAX_TEXT),
      requirements: z
        .array(z.looseObject({ statement: text(300) }))
        .max(MAX_REQUIREMENTS, say.tooLong(MAX_REQUIREMENTS)),
      dataReadiness: text(MAX_TEXT),
      integrationRequirements: text(MAX_TEXT),
      budgetMin: z.string(),
      budgetMax: z.string(),
      budgetToBeDetermined: z.boolean(),
      closesDay: z.string(),
      closesTime: z.string(),
    })
    .superRefine((value, context) => {
      const min = amount(value.budgetMin);
      const max = amount(value.budgetMax);
      if (!value.budgetToBeDetermined && min !== null && max !== null && max < min) {
        context.addIssue({ code: "custom", path: ["budgetMax"], message: say.budgetOutOfOrder });
      }
      if (
        value.closesDay === dayInVietnam(now()) &&
        value.closesTime !== "" &&
        Date.parse(instantInVietnam(value.closesDay, value.closesTime)) <= now()
      ) {
        context.addIssue({ code: "custom", path: ["closesDay"], message: say.closesInPast });
      }
    });
}

const unspoken: DraftSay = { tooLong: () => "", budgetOutOfOrder: "", closesInPast: "" };

/**
 * Whether the backend would take the draft as it is: nothing {@link draftSchema} refuses, each
 * amount empty or a whole number, the close day not past. A draft it would refuse is not sent, so
 * an amount it cannot read never overwrites the one saved.
 */
export function savable(values: DraftValues, now: () => number = Date.now): boolean {
  const amounts =
    values.budgetToBeDetermined ||
    [values.budgetMin, values.budgetMax].every(
      (text) => text.trim() === "" || amount(text) !== null,
    );
  const day = values.closesDay === "" || values.closesDay >= dayInVietnam(now());
  return amounts && day && draftSchema(unspoken, now).safeParse(values).success;
}

/** A schema issue's path as the form names the field: `requirements[3].statement`. */
export function fieldNameOf(path: readonly PropertyKey[]): string {
  return path
    .map((part, index) =>
      typeof part === "number" ? `[${part}]` : `${index === 0 ? "" : "."}${String(part)}`,
    )
    .join("");
}
