"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { FormDialog } from "@/components/composites/form-dialog";
import { useAppForm } from "@/components/form/app-form";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import { eventSchema, keyDateSchema, type EventValue, type KeyDateValue } from "./program-schemas";

type DialogProps<Value> = {
  /** The entry edited, or null to add one. */
  value: Value | null;
  onSave: (value: Value) => void;
  /** Present when the entry exists and can be taken out of the list. */
  onDelete?: () => void;
  onClose: () => void;
};

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
function KeyDateDialog({ value, onSave, onDelete, onClose }: DialogProps<KeyDateValue>) {
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
      aside={onDelete && <DeleteEntry label={s("delete")} onDelete={onDelete} />}
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
function EventDialog({ value, onSave, onDelete, onClose }: DialogProps<EventValue>) {
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
      aside={onDelete && <DeleteEntry label={s("delete")} onDelete={onDelete} />}
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
                {(field) => <field.TextField label={t("country")} maxLength={80} />}
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

export { EventDialog, KeyDateDialog };
