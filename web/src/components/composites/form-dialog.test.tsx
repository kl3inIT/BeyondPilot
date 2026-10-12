import { screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it } from "vitest";

import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { render } from "@/test/render";

import { FormDialog } from "./form-dialog";

/** A dialog that invites a person, opened from the page; `send` is what its submit waits for. */
function InviteDialog({ send }: { send: () => Promise<string | undefined> }) {
  const [open, setOpen] = useState(true);
  const form = useAppForm({
    defaultValues: { email: "" },
    onSubmit: async ({ formApi }) => {
      const refusal = await send();
      if (refusal) {
        setServerErrors(formApi, { form: refusal, fields: {} });
      } else {
        setOpen(false);
      }
    },
  });
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Invite a person
      </button>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title="Invite a person"
        submitLabel="Send"
        cancelLabel="Cancel"
      >
        <form.AppField name="email">{(field) => <field.TextField label="Email" />}</form.AppField>
      </FormDialog>
    </>
  );
}

/** A dialog that renames a row, opened from the row's menu: the item that opened it is gone by then. */
function RowMenu() {
  const [open, setOpen] = useState(false);
  const form = useAppForm({ defaultValues: { name: "" }, onSubmit: () => setOpen(false) });
  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label="Actions for Plain Cover" />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setOpen(true)}>Rename</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        form={form}
        title="Rename Plain Cover"
        submitLabel="Save"
        cancelLabel="Cancel"
      >
        <form.AppField name="name">{(field) => <field.TextField label="Name" />}</form.AppField>
      </FormDialog>
    </>
  );
}

/** A list whose rows open a dialog that can delete them, as the key dates of a program do. */
function KeyDates() {
  const [dates, setDates] = useState(["Kickoff"]);
  const [editing, setEditing] = useState<string | null>(null);
  const add = useRef<HTMLButtonElement>(null);
  const finalFocus = useRef<HTMLElement | null>(null);
  const form = useAppForm({ defaultValues: { title: "" }, onSubmit: () => setEditing(null) });
  return (
    <>
      {dates.map((date) => (
        <button key={date} type="button" onClick={() => setEditing(date)}>
          Edit {date}
        </button>
      ))}
      <button ref={add} type="button">
        Add a key date
      </button>
      {editing && (
        <FormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          form={form}
          title="Edit key date"
          submitLabel="Update"
          cancelLabel="Cancel"
          finalFocus={finalFocus}
          aside={
            <button
              type="button"
              onClick={() => {
                finalFocus.current = add.current;
                setDates(dates.filter((date) => date !== editing));
                setEditing(null);
              }}
            >
              Delete
            </button>
          }
        >
          <form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
        </FormDialog>
      )}
    </>
  );
}

/** A sending that ends when the test says so. */
function pending() {
  let settle: (refusal?: string) => void = () => {};
  const sent = new Promise<string | undefined>((resolve) => {
    settle = resolve;
  });
  return { send: () => sent, settle };
}

const sent = () => Promise.resolve(undefined);

describe("FormDialog", () => {
  it("closes by Cancel and by Escape while nothing is being sent", async () => {
    const { user } = render(<InviteDialog send={sent} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Invite a person" }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cannot be closed while the form is being sent, by Escape, Cancel or the cross", async () => {
    const sending = pending();
    const { user } = render(<InviteDialog send={sending.send} />);
    await user.type(screen.getByLabelText("Email"), "lan@example.com");

    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());
    expect(screen.getByRole("button", { name: "Send" })).toHaveAttribute("aria-busy", "true");
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("lan@example.com");

    sending.settle();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("starts the form again once it has closed", async () => {
    const { user } = render(<InviteDialog send={sent} />);
    await user.type(screen.getByLabelText("Email"), "lan@example.com");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Invite a person" }));

    expect(await screen.findByLabelText("Email")).toHaveValue("");
  });

  it("shows the refusal of the whole form above the buttons, and stays open", async () => {
    const { user } = render(
      <InviteDialog send={() => Promise.resolve("The invitation was not sent.")} />,
    );

    await user.click(screen.getByRole("button", { name: "Send" }));

    const refusal = await screen.findByRole("alert");
    expect(refusal).toHaveTextContent("The invitation was not sent.");
    expect(
      refusal.compareDocumentPosition(screen.getByRole("button", { name: "Cancel" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Email").compareDocumentPosition(refusal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("gives the focus back to the button that opened it", async () => {
    const { user } = render(<InviteDialog send={sent} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const opener = screen.getByRole("button", { name: "Invite a person" });
    await user.click(opener);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("gives the focus back to the menu of the row it was opened from", async () => {
    const { user } = render(<RowMenu />);
    await user.click(screen.getByRole("button", { name: "Actions for Plain Cover" }));
    await user.click(await screen.findByRole("menuitem", { name: "Rename" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Actions for Plain Cover" })).toHaveFocus(),
    );
  });

  it("gives the focus to what its caller names, once the row that opened it is deleted", async () => {
    const { user } = render(<KeyDates />);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Edit Kickoff" })).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Add a key date" })).toHaveFocus(),
    );
  });

  it("gives the focus back to the row while its caller names nothing", async () => {
    const { user } = render(<KeyDates />);
    await user.click(screen.getByRole("button", { name: "Edit Kickoff" }));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit Kickoff" })).toHaveFocus());
  });
});
