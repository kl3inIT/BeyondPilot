"use client";

import { CircleXIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { RequiredMark } from "@/components/composites/required-mark";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

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
  /** Who reads the message. */
  messageHint: string;
  confirmLabel: string;
  cancelLabel: string;
  /** True while the decision is sent: the confirm button shows it and neither button can be used. */
  pending: boolean;
  onConfirm: (reason: string, message: string) => void;
};

/**
 * Asks for the reason of a refusal before it is made: one reason out of a short list, and a message
 * for the people it concerns. No reason is chosen for the operator, and none means no decision. It stays open while the decision is sent; whoever opened it closes it.
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
  const reasonId = useId();
  const messageId = useId();
  const hintId = useId();
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DecisionDialogHeader
          tone="danger"
          icon={CircleXIcon}
          title={title}
          description={description}
        />
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={reasonId}>
              {reasonLabel}
              <RequiredMark />
            </FieldLabel>
            <NativeSelect
              id={reasonId}
              className="w-full"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <NativeSelectOption value="" disabled>
                {reasonPlaceholder}
              </NativeSelectOption>
              {reasons.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor={messageId}>{messageLabel}</FieldLabel>
            <Textarea
              id={messageId}
              rows={4}
              maxLength={1000}
              value={message}
              aria-describedby={hintId}
              onChange={(event) => setMessage(event.target.value)}
            />
            <FieldDescription id={hintId}>{messageHint}</FieldDescription>
          </Field>
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
          <Button
            size="lg"
            tone="danger"
            pending={pending}
            disabled={!reason}
            onClick={() => onConfirm(reason, message)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ReasonDialog };
