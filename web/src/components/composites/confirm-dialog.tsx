"use client";

import { CircleHelpIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/actions/button";
import { DecisionMark } from "@/components/composites/decision-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
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
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <DecisionMark
            tone={tone === "danger" ? "danger" : "info"}
            icon={tone === "danger" ? TriangleAlertIcon : CircleHelpIcon}
          />
          <AlertDialogTitle size="lg">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </div>
        {children}
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
        <AlertDialogFooter variant="plain">
          <Button
            size="lg"
            prominence="secondary"
            disabled={pending}
            autoFocus
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button size="lg" tone={tone} pending={pending} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
