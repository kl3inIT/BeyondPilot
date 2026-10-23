"use client";

import { CircleHelpIcon, TriangleAlertIcon } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/actions/button";
import { DecisionMark } from "@/components/composites/decision-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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
 *
 * The dialog itself puts the focus on Cancel (`initialFocus`). The `autoFocus` attribute would move
 * it as the button mounts, before the dialog has noted where the focus was, so that closing could
 * only return it to a button that no longer exists. Closing returns the focus to what had it
 * before: the button that opened the dialog, the menu button of the row for a dialog opened from
 * a menu item, the opener of the dialog this one replaced.
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
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <AlertDialogContent initialFocus={cancel}>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <DecisionMark
            tone={tone === "danger" ? "danger" : "info"}
            icon={tone === "danger" ? TriangleAlertIcon : CircleHelpIcon}
          />
          <AlertDialogTitle size="lg">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </div>
        {children}
        {/* The note lines up with what is above it: the card when there is one, else the description. */}
        {note && (
          <p className={cn("text-sm text-muted-foreground", !children && "text-center")}>{note}</p>
        )}
        <AlertDialogFooter variant="plain">
          <Button
            ref={cancel}
            size="lg"
            prominence="secondary"
            disabled={pending}
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
