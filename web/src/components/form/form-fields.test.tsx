import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { render } from "@/test/render";

import { useAppForm } from "./app-form";
import { AllRequired } from "./form-fields";

const schema = z.object({
  name: z.string().min(1, "Fill this in."),
  summary: z.string(),
});

/** A form of two fields, as a feature writes one; the props of its fields are the test's. */
function ProfileForm({
  formId,
  name,
  summary,
}: {
  formId?: string;
  name?: Partial<React.ComponentProps<"input">> & {
    description?: string;
    requiredMark?: boolean;
    optional?: boolean;
    uncounted?: boolean;
  };
  summary?: { maxLength?: number };
}) {
  const form = useAppForm({
    formId,
    defaultValues: { name: "", summary: "" },
    validators: { onSubmit: schema },
  });
  return (
    <form
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.AppField name="name">
        {(field) => <field.TextField label="Name" {...name} />}
      </form.AppField>
      <form.AppField name="summary">
        {(field) => <field.TextareaField label="Summary" {...summary} />}
      </form.AppField>
      <form.AppForm>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

const counter = /\d+ \/ \d+/;

const sizes = [
  { value: "small", label: "Small" },
  { value: "large", label: "Large" },
];

/** One field of each kind, each with the marks the test gives it; `everyField` is a form that says all of them are required. */
function KindsForm({
  marks = {},
  agree,
  everyField = false,
}: {
  marks?: { requiredMark?: boolean; optional?: boolean; required?: boolean };
  /** Whether the box must be ticked. */
  agree?: boolean;
  everyField?: boolean;
}) {
  const form = useAppForm({
    defaultValues: { name: "", about: "", size: "", city: "", agreed: false },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, "Fill this in."),
        about: z.string().min(1, "Fill this in."),
        size: z.string().min(1, "Choose one."),
        city: z.string(),
        agreed: z.boolean(),
      }),
    },
  });
  const fields = (
    <>
      <form.AppField
        name="name"
        validators={{
          onBlur: ({ value }) => (value === "x" ? "Write the whole name." : undefined),
        }}
      >
        {(field) => <field.TextField label="Name" {...marks} />}
      </form.AppField>
      <form.AppField name="about">
        {(field) => <field.TextareaField label="About" {...marks} />}
      </form.AppField>
      <form.AppField name="size">
        {(field) => <field.SelectField label="Size" options={sizes} {...marks} />}
      </form.AppField>
      <form.AppField name="city">
        {(field) => <field.ComboboxField label="City" options={sizes} {...marks} />}
      </form.AppField>
      <form.AppField name="agreed">
        {(field) => <field.CheckboxField label="I agree" required={agree} />}
      </form.AppField>
    </>
  );
  return (
    <form
      id={form.formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {everyField ? <AllRequired>{fields}</AllRequired> : fields}
      <form.AppForm>
        <form.SubmitButton>Save</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

/** The four controls a person types into or chooses from, by their labels. */
const typed = () =>
  [/^Name/, /^About/, /^Size/, /^City/].map((label) => screen.getByLabelText(label));

describe("the shared form controls", () => {
  describe("hint and error", () => {
    it("ties the hint to the control", () => {
      render(<ProfileForm name={{ description: "As on your badge." }} />);

      const control = screen.getByLabelText("Name");
      expect(control).toHaveAttribute("aria-describedby", `${control.id}-hint`);
      expect(control).toHaveAccessibleDescription("As on your badge.");
    });

    it("describes a control without a hint by nothing", () => {
      render(<ProfileForm />);

      expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
    });

    it("ties the error of a refused submit to the control, after the hint", async () => {
      const { user } = render(<ProfileForm name={{ description: "As on your badge." }} />);

      await user.click(screen.getByRole("button", { name: "Save" }));

      const control = screen.getByLabelText("Name");
      await waitFor(() => expect(control).toBeInvalid());
      expect(control).toHaveAttribute("aria-describedby", `${control.id}-hint ${control.id}-error`);
      expect(control).toHaveAccessibleDescription("As on your badge. Fill this in.");
    });

    it("keeps an id the caller adds before its own", () => {
      render(
        <>
          <p id="legend">Shown on the public page.</p>
          <ProfileForm name={{ description: "As on your badge.", "aria-describedby": "legend" }} />
        </>,
      );

      expect(screen.getByLabelText("Name")).toHaveAccessibleDescription(
        "Shown on the public page. As on your badge.",
      );
    });

    it("drops the error once the person corrects the field and submits again", async () => {
      const { user } = render(<ProfileForm />);
      await user.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText("Fill this in.");

      await user.type(screen.getByLabelText("Name"), "Lan");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.queryByText("Fill this in.")).not.toBeInTheDocument());
      expect(screen.getByLabelText("Name")).toBeValid();
      expect(screen.getByLabelText("Name")).not.toHaveAttribute("aria-describedby");
    });
  });

  describe("ids", () => {
    it("start with the id of the form", () => {
      render(<ProfileForm formId="profile" name={{ description: "As on your badge." }} />);

      expect(screen.getByLabelText("Name")).toHaveAttribute("id", "profile-name");
      expect(screen.getByText("As on your badge.")).toHaveAttribute("id", "profile-name-hint");
    });

    it("are shared by no two forms that name a field alike", async () => {
      const { user } = render(
        <>
          <ProfileForm name={{ description: "As on your badge." }} />
          <ProfileForm name={{ description: "As on your badge." }} />
        </>,
      );
      const controls = screen.getAllByLabelText("Name");
      const saves = screen.getAllByRole("button", { name: "Save" });

      // One form after the other: leaving a field for the other form takes its error away.
      const described: string[] = [];
      for (const [index, control] of controls.entries()) {
        await user.click(saves[index]);
        await waitFor(() => expect(control).toBeInvalid());
        expect(control).toHaveAccessibleDescription("As on your badge. Fill this in.");
        described.push(...(control.getAttribute("aria-describedby") ?? "").split(" "));
      }

      const ids = [
        ...controls.map((control) => control.id),
        ...screen.getAllByLabelText("Summary").map((control) => control.id),
        ...described,
      ];
      expect(ids).toHaveLength(8);
      expect(ids.every(Boolean)).toBe(true);
      expect(new Set(ids).size).toBe(8);
    });
  });

  describe("counter", () => {
    it("shows how much of a textarea's limit is used", async () => {
      const { user } = render(<ProfileForm summary={{ maxLength: 500 }} />);
      expect(screen.getByText("0 / 500")).toBeInTheDocument();

      await user.type(screen.getByLabelText("Summary"), "Rice");

      expect(await screen.findByText("4 / 500")).toBeInTheDocument();
    });

    it("marks text set past the limit at once, which the browser lets a script do", () => {
      render(<ProfileForm summary={{ maxLength: 5 }} />);
      const summary = screen.getByLabelText("Summary");
      expect(summary).not.toHaveAttribute("aria-invalid");

      fireEvent.change(summary, { target: { value: "Rice paddy" } });

      expect(summary).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByText("10 / 5")).toHaveClass("text-destructive");
    });

    it("shows none for a textarea without a limit", () => {
      render(<ProfileForm />);

      expect(screen.queryByText(counter)).not.toBeInTheDocument();
    });

    it("shows for a text input from a limit of 60 characters", () => {
      render(<ProfileForm name={{ maxLength: 60 }} />);

      expect(screen.getByText("0 / 60")).toBeInTheDocument();
    });

    it("shows none for a text input with a shorter limit", () => {
      render(<ProfileForm name={{ maxLength: 59 }} />);

      expect(screen.queryByText(counter)).not.toBeInTheDocument();
    });

    it("shows none for a text input marked uncounted", () => {
      render(<ProfileForm name={{ maxLength: 200, uncounted: true }} />);

      expect(screen.queryByText(counter)).not.toBeInTheDocument();
    });

    it("shows none for an address", () => {
      render(<ProfileForm name={{ maxLength: 200, type: "email" }} />);

      expect(screen.queryByText(counter)).not.toBeInTheDocument();
    });
  });

  describe("label", () => {
    it("carries the star of a field that must be filled, kept out of the control's name", () => {
      render(<ProfileForm name={{ requiredMark: true }} />);

      expect(within(screen.getByText("Name")).getByText("*")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
      expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
    });

    it("carries no star otherwise", () => {
      render(<ProfileForm />);

      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    it("says when a field is optional", () => {
      render(<ProfileForm name={{ optional: true }} />);

      expect(within(screen.getByText("Name")).getByText("Optional")).toBeInTheDocument();
    });
  });

  describe("a field that must be filled", () => {
    it("is said required by its control, of every kind, when it carries the star", () => {
      render(<KindsForm marks={{ requiredMark: true }} />);

      for (const control of typed()) {
        expect(control).toBeRequired();
        // The browser's own check, and its message, stay out of the forms.
        expect(control.matches("[required]")).toBe(false);
      }
    });

    it("is not said required without a mark", () => {
      render(<KindsForm />);

      for (const control of [...typed(), screen.getByRole("checkbox", { name: "I agree" })]) {
        expect(control).not.toBeRequired();
      }
    });

    it("is said required without a star when its caller says so", () => {
      render(<KindsForm marks={{ required: true }} agree />);

      for (const control of [...typed(), screen.getByRole("checkbox", { name: "I agree" })]) {
        expect(control).toBeRequired();
      }
      expect(screen.queryByText("*")).not.toBeInTheDocument();
    });

    describe("in a form that says every field is required unless marked Optional", () => {
      it("is every field, and never a box to tick", () => {
        render(<KindsForm everyField />);

        for (const control of typed()) {
          expect(control).toBeRequired();
        }
        expect(screen.getByRole("checkbox", { name: "I agree" })).not.toBeRequired();
      });

      it.each([
        ["marked Optional", { optional: true }],
        ["named as an exception", { required: false }],
      ])("is not a field %s", (_, marks) => {
        render(<KindsForm everyField marks={marks} />);

        for (const control of typed()) {
          expect(control).not.toBeRequired();
        }
      });
    });
  });

  describe("what a screen reader hears of an error", () => {
    it("is the field the focus moved to after a refused submit, and no error speaking by itself", async () => {
      const { user } = render(<KindsForm />);

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
      expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Fill this in.");
      expect(screen.getByLabelText("About")).toHaveAccessibleDescription("Fill this in.");
      expect(screen.getByLabelText("Size")).toHaveAccessibleDescription("Choose one.");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("is the error itself when a rule checked on leaving the field set it", async () => {
      const { user } = render(<KindsForm />);

      await user.type(screen.getByLabelText("Name"), "x");
      await user.tab();

      expect(await screen.findByRole("alert")).toHaveTextContent("Write the whole name.");
      expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Write the whole name.");
    });
  });
});
