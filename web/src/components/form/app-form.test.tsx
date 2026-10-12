import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { render } from "@/test/render";

import { setServerErrors, useAppForm } from "./app-form";

const schema = z.object({
  title: z.string().min(1, "Fill this in."),
  name: z.string().min(1, "Fill this in."),
  email: z.string().min(1, "Fill this in."),
});

/** A form whose first field is filled, and whose server refuses the address it is sent. */
function InviteForm() {
  const form = useAppForm({
    defaultValues: { title: "Welcome", name: "", email: "" },
    validators: { onSubmit: schema },
    onSubmit: ({ formApi }) => {
      setServerErrors(formApi, {
        form: "The invitation was not sent.",
        fields: { email: { message: "This address already has an account." } },
      });
    },
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
      <form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
      <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
      <form.AppForm>
        <form.FormError />
        <form.SubmitButton>Send</form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

describe("a form made with useAppForm", () => {
  it("moves the focus to the first field in error when its rules refuse the submit", async () => {
    const { user } = render(<InviteForm />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
    expect(screen.getByLabelText("Title")).toBeValid();
    expect(screen.getByLabelText("Name")).toBeInvalid();
    expect(screen.getByLabelText("Email")).toBeInvalid();
  });

  it("is refused by the keyboard as by the button", async () => {
    const { user } = render(<InviteForm />);

    await user.type(screen.getByLabelText("Title"), "{Enter}");

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveFocus());
  });

  it("shows what the server refused under its field and above the button, and moves the focus to the field", async () => {
    const { user } = render(<InviteForm />);
    await user.type(screen.getByLabelText("Name"), "Lan");
    await user.type(screen.getByLabelText("Email"), "lan@example.com");

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByLabelText("Email")).toHaveFocus());
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription(
      "This address already has an account.",
    );
    expect(screen.getByText("The invitation was not sent.")).toBeInTheDocument();
  });

  it("takes the server's refusal away once the person edits the form", async () => {
    const { user } = render(<InviteForm />);
    await user.type(screen.getByLabelText("Name"), "Lan");
    await user.type(screen.getByLabelText("Email"), "lan@example.com");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("The invitation was not sent.");

    await user.type(screen.getByLabelText("Email"), "x");

    expect(screen.queryByText("The invitation was not sent.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeValid();
  });
});
