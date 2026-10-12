import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { render } from "@/test/render";

import { useAppForm } from "./app-form";

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
      expect(await screen.findByRole("alert")).toHaveTextContent("Fill this in.");
      expect(control).toBeInvalid();
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
      await screen.findByRole("alert");

      await user.type(screen.getByLabelText("Name"), "Lan");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
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

      expect(screen.getByText("4 / 500")).toBeInTheDocument();
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
});
