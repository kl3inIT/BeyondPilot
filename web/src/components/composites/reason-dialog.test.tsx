import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { render } from "@/test/render";

import { ReasonDialog } from "./reason-dialog";

/** A refusal asked from the menu of a row: the item that opened it is gone by then. */
function RowMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label="Actions for Plain Cover" />
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => setOpen(true)}>Take down</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title="Take Plain Cover down?"
        description="It leaves the directory."
        reasonLabel="Reason"
        reasonPlaceholder="Choose a reason"
        reasons={[{ value: "duplicate", label: "A duplicate" }]}
        messageLabel="Message"
        confirmLabel="Take down"
        cancelLabel="Cancel"
        pending={false}
        onConfirm={() => {}}
      />
    </>
  );
}

describe("ReasonDialog", () => {
  it("gives the focus back to the menu of the row it was opened from", async () => {
    const { user } = render(<RowMenu />);
    await user.click(screen.getByRole("button", { name: "Actions for Plain Cover" }));
    await user.click(await screen.findByRole("menuitem", { name: "Take down" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Actions for Plain Cover" })).toHaveFocus(),
    );
  });
});
