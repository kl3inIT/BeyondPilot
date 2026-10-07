import { z } from "zod";

import { currencies } from "./use-case-budget";

import {
  necessities,
  publishChoices,
  timelineCodes,
  useCaseIndustries,
  useCaseTechnologies,
} from "./admin-use-case-codes";

/** The words a schema's messages are written in; the form passes its translator. */
type Say = (
  key: "required" | "tooLong" | "positive" | "budgetOutOfOrder",
  values?: { max: number },
) => string;

/** An amount in its currency: 0 or a whole number of up to thirteen digits, wide enough for đồng. */
const whole = /^(0|[1-9]\d{0,12})$/;

/** The most any text of the form holds, as the backend takes it. */
export const MAX_TEXT = 2000;

/** What the admin form holds before it is sent: numbers and the close day as typed. */
export function adminUseCaseSchema(say: Say) {
  const text = (max: number) =>
    z.string().trim().min(1, say("required")).max(max, say("tooLong", { max }));
  const amount = z.string().refine((value) => value === "" || whole.test(value), {
    message: say("positive"),
  });

  return z
    .object({
      organizationId: z.string().min(1, say("required")),
      title: text(200),
      problemStatement: text(MAX_TEXT),
      industry: z.enum(useCaseIndustries, say("required")),
      technologies: z.array(z.enum(useCaseTechnologies)).min(1, say("required")),
      expectedOutcomes: text(MAX_TEXT),
      currentProcess: text(MAX_TEXT),
      currentSolutions: z
        .string()
        .trim()
        .max(MAX_TEXT, say("tooLong", { max: MAX_TEXT })),
      targetUsers: text(MAX_TEXT),
      requirements: z
        .array(z.object({ statement: text(300), necessity: z.enum(necessities) }))
        .min(1, say("required")),
      dataReadiness: text(MAX_TEXT),
      integrationRequirements: text(MAX_TEXT),
      attachments: z
        .array(
          z.object({
            id: z.string(),
            fileName: z.string(),
            sizeBytes: z.number(),
            uploadedAt: z.string().optional(),
          }),
        )
        .max(10),
      currency: z.enum(currencies),
      budgetMin: amount,
      budgetMax: amount,
      budgetToBeDetermined: z.boolean(),
      budgetMembersOnly: z.boolean(),
      timeline: z.enum(timelineCodes, say("required")),
      hideOrganizationName: z.boolean(),
      publish: z.enum(publishChoices),
      closesDay: z.string().min(1, say("required")),
      closesTime: z.string().min(1, say("required")),
    })
    .superRefine((value, context) => {
      if (value.budgetToBeDetermined) {
        return;
      }
      for (const field of ["budgetMin", "budgetMax"] as const) {
        if (value[field] === "") {
          context.addIssue({ code: "custom", path: [field], message: say("required") });
        }
      }
      if (
        value.budgetMin !== "" &&
        value.budgetMax !== "" &&
        Number(value.budgetMin) > Number(value.budgetMax)
      ) {
        context.addIssue({ code: "custom", path: ["budgetMax"], message: say("budgetOutOfOrder") });
      }
    });
}

export type AdminUseCaseValues = z.input<ReturnType<typeof adminUseCaseSchema>>;
