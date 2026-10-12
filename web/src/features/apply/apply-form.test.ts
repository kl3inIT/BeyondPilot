import { FieldApi, FormApi } from "@tanstack/react-form";
import { describe, expect, it } from "vitest";

import type { ApplicationView } from "@/lib/api/generated";

import { applyFormOptions, checkAgain } from "./apply-form";
import {
  applyStepSchema,
  contactShapeSchema,
  problemsOf,
  type ApplyContext,
  type ApplyStep,
  type ApplyWords,
} from "./apply-schemas";
import { valuesOf } from "./apply-values";

// The form as the flow sets it up, driven as the screen drives it: the fields of the step on the
// screen are mounted, and Continue is `checkAgain` then a submit.

// Each message is its own key, so a test reads which rule refused.
const words = new Proxy({}, { get: (_, key) => String(key) }) as ApplyWords;
const question = "7c1e0a2b-0000-4000-8000-000000000002";
const questions: ApplyContext["questions"] = [{ id: question, kind: "long_text", required: true }];

function applying() {
  const seen = { step: "you" as ApplyStep, submitted: 0, changed: [] as string[] };
  const form = new FormApi(
    applyFormOptions({
      defaults: valuesOf(
        { program: { questions }, solutions: [] } as unknown as ApplicationView,
        {},
      ),
      problems: (values) =>
        problemsOf(
          applyStepSchema(seen.step, words, { organization: null, who: values.who, questions }),
          values,
        ),
      problemsOnLeaving: (values) =>
        seen.step === "you" ? problemsOf(contactShapeSchema(words), values) : undefined,
      changed: (field) => seen.changed.push(field),
      submit: async () => {
        seen.submitted += 1;
      },
    }),
  );
  form.mount();
  /** Puts a field on the screen; answers it with the way to take it off again. */
  const field = (name: string) => {
    const api = new FieldApi({ form: form as never, name: name as never });
    return { api, leave: api.mount() };
  };
  const proceed = async () => {
    checkAgain(form);
    await form.handleSubmit();
  };
  /** The errors the fields hold, as the controls would show them. */
  const errors = () =>
    Object.fromEntries(
      Object.entries(form.state.fieldMeta as Record<string, { errors: { message: string }[] }>)
        .filter(([, meta]) => meta.errors.length > 0)
        .map(([name, meta]) => [name, [...new Set(meta.errors.map((error) => error.message))]]),
    );
  return { form, seen, field, proceed, errors };
}

const contactFields = ["firstName", "lastName", "phone", "country", "linkedin"].map(
  (name) => `application.contact.${name}`,
);

describe("the application form", () => {
  it("keeps every error of a step through a second refused Continue", async () => {
    const { seen, field, proceed, errors } = applying();
    const who = field("who");
    contactFields.forEach(field);

    await proceed();
    expect(errors()).toEqual({
      who: ["whoRequired"],
      "application.contact.firstName": ["required"],
      "application.contact.lastName": ["required"],
      "application.contact.phone": ["phoneRequired"],
      "application.contact.country": ["countryRequired"],
    });

    // Who applies is chosen; the rest is still missing, the phone number included.
    who.api.handleChange("individual" as never);
    await proceed();
    expect(errors()).toEqual({
      "application.contact.firstName": ["required"],
      "application.contact.lastName": ["required"],
      "application.contact.phone": ["phoneRequired"],
      "application.contact.country": ["countryRequired"],
    });
    expect(seen.submitted).toBe(0);
  });

  it("checks the step again as the person types, once it was refused", async () => {
    const { field, proceed, errors } = applying();
    const first = field("application.contact.firstName");
    await proceed();

    first.api.handleChange("An" as never);
    expect(errors()).not.toHaveProperty(["application.contact.firstName"]);
    first.api.handleChange("" as never);
    expect(errors()).toHaveProperty(["application.contact.firstName"], ["required"]);
  });

  it("says a number the backend would refuse when its field is left, before any Continue", () => {
    const { field, errors } = applying();
    const phone = field("application.contact.phone");
    const linkedin = field("application.contact.linkedin");

    phone.api.handleChange("call me" as never);
    expect(errors()).toEqual({});
    phone.api.handleBlur();
    expect(errors()).toEqual({ "application.contact.phone": ["phoneRequired"] });

    linkedin.api.handleChange("linkedin.com/in/antran" as never);
    linkedin.api.handleBlur();
    expect(errors()).toHaveProperty(["application.contact.linkedin"], ["linkedinInvalid"]);
  });

  it("lets a number corrected without leaving its field through, as Enter sends it", async () => {
    const { form, seen, field, proceed, errors } = applying();
    field("who").api.handleChange("individual" as never);
    const [, , phone] = contactFields.map(field);
    form.setFieldValue("application.contact.firstName", "An");
    form.setFieldValue("application.contact.lastName", "Tran");
    form.setFieldValue("application.contact.country", "VN");

    phone.api.handleChange("call me" as never);
    phone.api.handleBlur();
    expect(errors()).toEqual({ "application.contact.phone": ["phoneRequired"] });
    phone.api.handleChange("+84 912 345 678" as never);
    await proceed();

    expect(errors()).toEqual({});
    expect(seen.submitted).toBe(1);
  });

  it("does not hold a step back by what a step no longer on the screen was refused for", async () => {
    const { form, seen, field, proceed, errors } = applying();
    seen.step = "questions";
    const answer = field(`application.answers.${question}`);
    await proceed();
    expect(errors()).toEqual({ [`application.answers.${question}`]: ["answerRequired"] });

    answer.leave();
    seen.step = "review";
    form.setFieldValue("confirmed", true);
    field("confirmed");
    await proceed();

    expect(seen.submitted).toBe(1);
  });

  it("tells the flow which field a person changed, and nothing of what the form writes itself", () => {
    const { form, seen, field } = applying();
    const quietly = { dontUpdateMeta: true, dontRunListeners: true, dontValidate: true };
    const application = form.state.values.application;

    field("who").api.handleChange("team" as never);
    // Who applies is no part of the stored draft: the draft is the same object, so no save waits.
    expect(form.state.values.application).toBe(application);
    field("application.traction").api.handleChange("Two pilots." as never);
    form.setFieldValue("application.solutionId", "5a0b7c1d-0000-4000-8000-000000000010", quietly);

    expect(seen.changed).toEqual(["who", "application.traction"]);
    expect(form.state.values.application).not.toBe(application);
  });
});
