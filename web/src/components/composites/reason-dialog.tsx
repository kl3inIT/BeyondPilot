"use client";

import { useStore } from "@tanstack/react-form";
import { CircleXIcon } from "lucide-react";

import { Button } from "@/components/actions/button";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

type ReasonDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What is about to happen and to whom, in one line. */
  description: string;
  reasonLabel: string;
  /** The words of the select before a reason is chosen: "Choose a reason". */
  reasonPlaceholder: string;
  reasons: { value: string; label: string }[];
  messageLabel: string;
  /** Who reads the message, when it is worth saying. */
  messageHint?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** True while the decision is sent: the confirm button shows it and neither button can be used. */
  pending: boolean;
  onConfirm: (reason: string, message: string) => void;
};

/**
 * Asks for the reason of a refusal before it is made: one reason out of a short list, and a message
 * for the people it concerns. No reason is chosen for the operator, and none means no decision. It stays open while the decision is sent; whoever opened it closes it.
 * Its frame is its own, not `FormDialog`'s: the caller holds `pending`, and the button that refuses is red.
 */
function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel,
  reasonPlaceholder,
  reasons,
  messageLabel,
  messageHint,
  confirmLabel,
  cancelLabel,
  pending,
  onConfirm,
}: ReasonDialogProps) {
  const form = useAppForm({
    defaultValues: { reason: "", message: "" },
    onSubmit: ({ value }) => onConfirm(value.reason, value.message),
  });
  const reason = useStore(form.store, (state) => state.values.reason);

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <form
          id={form.formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // React passes the event to the page's own form, when the dialog was opened from one.
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          <DecisionDialogHeader
            tone="danger"
            icon={CircleXIcon}
            title={title}
            description={description}
          />
          <FieldGroup>
            <form.AppField name="reason">
              {(field) => (
                <field.SelectField
                  label={reasonLabel}
                  requiredMark
                  placeholder={reasonPlaceholder}
                  options={reasons}
                />
              )}
            </form.AppField>
            <form.AppField name="message">
              {(field) => (
                <field.TextareaField
                  label={messageLabel}
                  rows={4}
                  maxLength={1000}
                  description={messageHint}
                />
              )}
            </form.AppField>
          </FieldGroup>
          <DialogFooter variant="plain">
            <Button
              size="lg"
              prominence="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button type="submit" size="lg" tone="danger" pending={pending} disabled={!reason}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { ReasonDialog };
