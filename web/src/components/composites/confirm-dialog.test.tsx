import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Button } from "@/components/actions/button";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { render } from "@/test/render";

import { ConfirmDialog } from "./confirm-dialog";

const asks = {
  title: "Remove Plain Cover?",
  description: "Its people lose their access.",
  confirmLabel: "Remove",
  cancelLabel: "Cancel",
  tone: "danger",
  pending: false,
  onConfirm: () => {},
} as const;

/** A confirmation opened by a button of the page, which holds whether it is open. */
function RemoveButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Remove organization</Button>
      <ConfirmDialog {...asks} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** A confirmation opened from the menu of a row: the item that opened it is gone by then. */
function RowMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label="Actions for Plain Cover" />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setOpen(true)}>Remove</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog {...asks} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** A choice in one dialog, then the confirmation in its place, as merging two organizations asks. */
function TwoSteps() {
  const [step, setStep] = useState<"closed" | "choose" | "confirm">("closed");
  const close = () => setStep("closed");
  return (
    <>
      <Button onClick={() => setStep("choose")}>Merge</Button>
      {step === "choose" && (
        <Dialog open onOpenChange={(open) => !open && close()}>
          <DialogContent showCloseButton={false}>
            <DialogTitle>Merge Plain Cover</DialogTitle>
            <Button onClick={() => setStep("confirm")}>Continue</Button>
          </DialogContent>
        </Dialog>
      )}
      {step === "confirm" && (
        <ConfirmDialog {...asks} open onOpenChange={(open) => !open && close()} />
      )}
    </>
  );
}

const cancel = () => screen.getByRole("button", { name: "Cancel" });
const gone = () => waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

describe("ConfirmDialog", () => {
  it("opens with the focus on Cancel, the choice that changes nothing", async () => {
    const { user } = render(<RemoveButton />);

    await user.click(screen.getByRole("button", { name: "Remove organization" }));

    await waitFor(() => expect(cancel()).toHaveFocus());
  });

  it.each([
    ["Cancel", (user: ReturnType<typeof render>["user"]) => user.click(cancel())],
    ["Escape", (user: ReturnType<typeof render>["user"]) => user.keyboard("{Escape}")],
  ])("gives the focus back to the button that opened it, closed by %s", async (_, close) => {
    const { user } = render(<RemoveButton />);
    await user.click(screen.getByRole("button", { name: "Remove organization" }));
    await waitFor(() => expect(cancel()).toHaveFocus());

    await close(user);

    await gone();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Remove organization" })).toHaveFocus(),
    );
  });

  it("gives the focus back to the menu of the row it was opened from", async () => {
    const { user } = render(<RowMenu />);
    await user.click(screen.getByRole("button", { name: "Actions for Plain Cover" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remove" }));
    await waitFor(() => expect(cancel()).toHaveFocus());

    await user.click(cancel());

    await gone();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Actions for Plain Cover" })).toHaveFocus(),
    );
  });

  it("opens with the focus on Cancel when it takes the place of another dialog", async () => {
    const { user } = render(<TwoSteps />);
    await user.click(screen.getByRole("button", { name: "Merge" }));
    await user.click(await screen.findByRole("button", { name: "Continue" }));

    await screen.findByRole("alertdialog");
    await waitFor(() => expect(cancel()).toHaveFocus());
    // And it stays there: the dialog that left does not take the focus with it a moment later.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await waitFor(() => expect(cancel()).toHaveFocus());

    await user.keyboard("{Escape}");
    await gone();
    await waitFor(() => expect(screen.getByRole("button", { name: "Merge" })).toHaveFocus());
  });
});
