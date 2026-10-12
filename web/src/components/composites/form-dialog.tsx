"use client";

import { useStore, type AnyFormApi } from "@tanstack/react-form";
import type { ComponentProps, ComponentType, PropsWithChildren, ReactNode } from "react";

import { Button } from "@/components/actions/button";
import { DecisionDialogHeader } from "@/components/composites/decision-dialog";
import type { FormError, SubmitButton } from "@/components/form/form-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** What the dialog uses of a form made with `useAppForm`. */
type DialogForm = Pick<AnyFormApi, "formId" | "handleSubmit" | "reset" | "store"> & {
  AppForm: ComponentType<PropsWithChildren>;
  SubmitButton: typeof SubmitButton;
  FormError: typeof FormError;
};

type FormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The form from `useAppForm`; its `onSubmit` sends the data and closes the dialog. */
  form: DialogForm;
  title: ReactNode;
  description?: ReactNode;
  /**
   * The round mark of a decision dialog, for a form that invites or creates on someone's behalf:
   * the head is centred and the two buttons share the width, as in `ConfirmDialog`.
   */
  mark?: Pick<ComponentProps<typeof DecisionDialogHeader>, "tone" | "icon">;
  /** How wide the dialog may grow from a tablet up: `sm` for a field or two, `3xl` for two columns. */
  width?: "sm" | "md" | "lg" | "xl" | "3xl";
  submitLabel: string;
  cancelLabel: string;
  /** True while what the form holds cannot be sent, by a rule its schema does not carry. */
  submitDisabled?: boolean;
  /** An action that is not the form's, at the start of the footer: Delete on an entry that exists. */
  aside?: ReactNode;
  /** The fields. */
  children: ReactNode;
};

/**
 * A dialog that holds a form (docs/conventions.md › Forms). It owns the frame: the title and the
 * line under it, the `<form>` and its submit, the form-level error above the buttons, Cancel and
 * the submit button, which shows the form pending. It cannot be closed while the form is sent,
 * the form starts again once it has closed, and a body taller than the screen scrolls between the
 * head and the buttons.
 */
function FormDialog({
  open,
  onOpenChange,
  form,
  title,
  description,
  mark,
  width = "sm",
  submitLabel,
  cancelLabel,
  submitDisabled,
  aside,
  children,
}: FormDialogProps) {
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  const size = mark ? "lg" : "md";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (submitting ? undefined : onOpenChange(next))}
      // After the closing animation, so the fields do not empty while the dialog fades.
      onOpenChangeComplete={(next) => {
        if (!next) {
          form.reset();
        }
      }}
    >
      {/* A column no taller than the screen, so the body can scroll between the head and the buttons. */}
      <DialogContent
        showCloseButton={!mark}
        data-width={width}
        className="flex max-h-dvh flex-col data-[width=3xl]:sm:max-w-3xl data-[width=lg]:sm:max-w-lg data-[width=md]:sm:max-w-md data-[width=xl]:sm:max-w-xl"
      >
        <form
          id={form.formId}
          noValidate
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // React passes the event to the page's own form, when the dialog was opened from one.
            event.stopPropagation();
            void form.handleSubmit();
          }}
        >
          {mark ? (
            <DecisionDialogHeader
              tone={mark.tone}
              icon={mark.icon}
              title={title}
              description={description}
            />
          ) : (
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
          )}
          {/* As wide as the dialog, so the scrolling box cuts no focus ring. */}
          <div className="-mx-4 -my-1 flex min-h-0 flex-col gap-4 overflow-y-auto px-4 py-1">
            {children}
          </div>
          <form.AppForm>
            <form.FormError />
            <DialogFooter variant={mark ? "plain" : "bar"}>
              {aside && <div className="flex flex-col sm:mr-auto">{aside}</div>}
              <Button
                size={size}
                prominence="secondary"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                {cancelLabel}
              </Button>
              <form.SubmitButton size={size} disabled={submitDisabled}>
                {submitLabel}
              </form.SubmitButton>
            </DialogFooter>
          </form.AppForm>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { FormDialog };
