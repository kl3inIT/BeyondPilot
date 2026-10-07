"use client";

import { Button } from "@/components/actions/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What is about to happen, in one line. */
  description: string;
  /** Who or what it concerns, shown as a card between the description and the note. */
  children?: React.ReactNode;
  /** The consequence and how it is undone. */
  note?: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "default" | "danger";
  /** True while the confirmed action runs: the confirm button shows it and neither button can be used. */
  pending: boolean;
  onConfirm: () => void;
};

/**
 * Asks before an action that is hard to take back. The dialog names what it concerns, says what
 * will happen and how it is undone; Cancel has the focus when it opens. It stays open while the
 * action runs, and whoever opened it closes it when the action has ended.
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  note,
  confirmLabel,
  cancelLabel,
  tone = "default",
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle size="lg">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        <AlertDialogFooter>
          <Button
            prominence="secondary"
            disabled={pending}
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button tone={tone} pending={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
