"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, type RefObject } from "react";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import {
  eventSchema,
  keyDateSchema,
  windowTitleSchema,
  type EventValue,
  type KeyDateValue,
} from "./program-schemas";

type DialogProps<Value> = {
  /** The entry edited, or null to add one. */
  value: Value | null;
  onSave: (value: Value) => void;
  /** Present when the entry exists and can be taken out of the list. */
  onDelete?: () => void;
  onClose: () => void;
  /**
   * The button that adds to the list. It takes the focus when the entry is deleted: the row whose
   * button opened the dialog is gone by then.
   */
  addButton: RefObject<HTMLElement | null>;
};

/**
 * Where the focus goes when a dialog of the list closes: to what opened it, which an empty ref
 * leaves to the dialog, and to the list's Add button once the entry was deleted.
 */
function useFocusAfterDelete(addButton: RefObject<HTMLElement | null>, onDelete?: () => void) {
  const finalFocus = useRef<HTMLElement | null>(null);
  const deleting =
    onDelete &&
    (() => {
      finalFocus.current = addButton.current;
      onDelete();
    });
  return { finalFocus, deleting };
}

const emptyKeyDate: KeyDateValue = {
  title: "",
  day: "",
  from: "",
  to: "",
  allDay: false,
  note: "",
};

/**
 * Adds or edits a key date. The entry goes into the program's list; it is stored when Settings is
 * saved, with everything else.
 */
function KeyDateDialog({ value, onSave, onDelete, onClose, addButton }: DialogProps<KeyDateValue>) {
  const { finalFocus, deleting } = useFocusAfterDelete(addButton, onDelete);
  const t = useTranslations("Admin.programs.settings.keyDate");
  const s = useTranslations("Admin.programs.settings");
  const say = useTranslations("Form.errors");
  const form = useAppForm({
    defaultValues: value ?? emptyKeyDate,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: keyDateSchema(say) },
    onSubmit: ({ value: saved }) => onSave(saved),
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={value ? t("editTitle") : t("addTitle")}
      width="lg"
      submitLabel={value ? t("update") : t("add")}
      cancelLabel={s("cancel")}
      aside={deleting && <DeleteEntry label={s("delete")} onDelete={deleting} />}
      finalFocus={finalFocus}
    >
      <form.AppField name="title">
        {(field) => <field.TextField label={t("title")} maxLength={160} autoComplete="off" />}
      </form.AppField>
      <form.AppField name="day">
        {(field) => <field.TextField label={t("day")} type="date" />}
      </form.AppField>
      <form.Subscribe selector={(state) => state.values.allDay}>
        {(allDay) =>
          !allDay && (
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="from">
                {(field) => <field.TextField label={t("from")} type="time" />}
              </form.AppField>
              <form.AppField name="to">
                {(field) => <field.TextField label={t("to")} type="time" optional />}
              </form.AppField>
            </div>
          )
        }
      </form.Subscribe>
      <form.AppField name="allDay">
        {(field) => <field.CheckboxField label={t("allDay")} />}
      </form.AppField>
      <form.AppField name="note">
        {(field) => (
          <field.TextField label={t("note")} optional maxLength={500} description={t("noteHint")} />
        )}
      </form.AppField>
    </FormDialog>
  );
}

const emptyEvent: EventValue = {
  title: "",
  startsDay: "",
  startsTime: "",
  endsDay: "",
  endsTime: "",
  online: true,
  city: "",
  country: "",
  registrationUrl: "",
};

/** Adds or edits an event of the program, stored when Settings is saved. */
function EventDialog({ value, onSave, onDelete, onClose, addButton }: DialogProps<EventValue>) {
  const { finalFocus, deleting } = useFocusAfterDelete(addButton, onDelete);
  const t = useTranslations("Admin.programs.settings.event");
  const s = useTranslations("Admin.programs.settings");
  const say = useTranslations("Form.errors");
  const form = useAppForm({
    defaultValues: value ?? emptyEvent,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: eventSchema(say) },
    onSubmit: ({ value: saved }) => onSave(saved),
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={value ? t("editTitle") : t("addTitle")}
      width="lg"
      submitLabel={value ? t("update") : t("add")}
      cancelLabel={s("cancel")}
      aside={deleting && <DeleteEntry label={s("delete")} onDelete={deleting} />}
      finalFocus={finalFocus}
    >
      <form.AppField name="title">
        {(field) => <field.TextField label={t("title")} maxLength={160} autoComplete="off" />}
      </form.AppField>
      <div className="grid grid-cols-2 gap-3">
        <form.AppField name="startsDay">
          {(field) => <field.TextField label={t("startsDay")} type="date" />}
        </form.AppField>
        <form.AppField name="startsTime">
          {(field) => <field.TextField label={t("startsTime")} type="time" />}
        </form.AppField>
        <form.AppField name="endsDay">
          {(field) => <field.TextField label={t("endsDay")} type="date" optional />}
        </form.AppField>
        <form.AppField name="endsTime">
          {(field) => <field.TextField label={t("endsTime")} type="time" optional />}
        </form.AppField>
      </div>
      <form.Field name="online">
        {(field) => (
          <Field>
            <FieldLabel>{t("where")}</FieldLabel>
            <RadioGroup
              value={field.state.value ? "online" : "inPerson"}
              onValueChange={(where) => field.handleChange(where === "online")}
              aria-label={t("where")}
            >
              <div className="flex gap-6">
                {(["online", "inPerson"] as const).map((where) => (
                  <Field key={where} orientation="horizontal" className="w-auto">
                    <RadioGroupItem value={where} id={`event-${where}`} />
                    <FieldLabel htmlFor={`event-${where}`}>{t(where)}</FieldLabel>
                  </Field>
                ))}
              </div>
            </RadioGroup>
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.online}>
        {(online) =>
          !online && (
            <div className="grid grid-cols-2 gap-3">
              <form.AppField name="city">
                {(field) => <field.TextField label={t("city")} maxLength={80} />}
              </form.AppField>
              <form.AppField name="country">
                {(field) => <field.TextField label={t("country")} maxLength={80} optional />}
              </form.AppField>
            </div>
          )
        }
      </form.Subscribe>
      <form.AppField name="registrationUrl">
        {(field) => (
          <field.TextField
            label={t("registrationUrl")}
            type="url"
            optional
            description={t("registrationUrlHint")}
          />
        )}
      </form.AppField>
    </FormDialog>
  );
}

/**
 * Takes the entry out of the list on the page. Like Add and Update it is stored only when Settings
 * is saved, which is why the dialog's button does not say Save.
 */
function DeleteEntry({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <Button prominence="tertiary" tone="danger" onClick={onDelete}>
      <Trash2Icon aria-hidden="true" />
      {label}
    </Button>
  );
}

/**
 * Renames a date the application window puts on the timeline. Its day and time stay the window's,
 * edited under Applications; an empty title gives the date its default words back. Like a key date
 * it is stored when Settings is saved.
 */
function WindowTitleDialog({
  value,
  defaultTitle,
  onSave,
  onClose,
}: {
  /** The operator's title, or empty when the date shows the default words. */
  value: string;
  /** The words the date shows without a title of its own, in the language of the screen. */
  defaultTitle: string;
  onSave: (title: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Admin.programs.settings.windowTitle");
  const s = useTranslations("Admin.programs.settings");
  const say = useTranslations("Form.errors");
  const form = useAppForm({
    defaultValues: { title: value },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: windowTitleSchema(say) },
    onSubmit: ({ value: saved }) => onSave(saved.title.trim()),
  });

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      form={form}
      title={t("dialogTitle", { name: defaultTitle })}
      width="lg"
      submitLabel={t("save")}
      cancelLabel={s("cancel")}
    >
      <form.AppField name="title">
        {(field) => (
          <field.TextField
            label={t("label")}
            optional
            maxLength={160}
            autoComplete="off"
            description={t("hint", { name: defaultTitle })}
          />
        )}
      </form.AppField>
    </FormDialog>
  );
}

export { EventDialog, KeyDateDialog, WindowTitleDialog };
