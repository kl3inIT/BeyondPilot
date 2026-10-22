"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Markdown from "react-markdown";

import { Button } from "@/components/actions/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { Consent } from "@/lib/api/generated";

import { everything, purposes, type ChoiceSource, type Choices } from "./consent-choices";
import { PurposeBadge } from "./consent-purpose";
import { splitConsentText } from "./consent-text";

type ConsentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consent: Consent;
  /** What the boxes hold when the dialog opens. */
  initial: Choices;
  pending: boolean;
  onSave: (choices: Choices, source: ChoiceSource) => void;
};

/**
 * The full consent text with one box for each purpose, none ticked by the screen. Save my choices
 * records them as ticked, and needs the first, which the platform cannot be used without; Accept
 * all ticks and records every one.
 */
function ConsentDialog({
  open,
  onOpenChange,
  consent,
  initial,
  pending,
  onSave,
}: ConsentDialogProps) {
  const t = useTranslations("Consent");
  const [choices, setChoices] = useState(initial);
  const [missing, setMissing] = useState(false);
  const { body, boxes, closing } = splitConsentText(consent.text);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setChoices(initial);
          setMissing(false);
        }
        if (!pending) {
          onOpenChange(next);
        }
      }}
    >
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle size="lg">{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.version", { version: consent.version })}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-2 text-muted-foreground [&_h2]:mt-3 [&_h2]:font-medium [&_h2]:text-foreground [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">
            <Markdown>{body}</Markdown>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium">{t("dialog.choices")}</legend>
            {purposes.map((purpose, index) => (
              <div
                key={purpose}
                className="rounded-lg border p-3 has-data-checked:border-primary/40 has-data-checked:bg-primary/5"
              >
                <Field orientation="horizontal">
                  <Checkbox
                    id={`consent-${purpose}`}
                    checked={choices[purpose]}
                    onCheckedChange={(checked) => {
                      setChoices({ ...choices, [purpose]: checked });
                      if (purpose === "platform") {
                        setMissing(false);
                      }
                    }}
                    aria-describedby={`consent-${purpose}-hint`}
                  />
                  <FieldContent>
                    <FieldLabel htmlFor={`consent-${purpose}`}>
                      {boxes[index] ?? t(`purposes.${purpose}.short`)}
                    </FieldLabel>
                    <FieldDescription id={`consent-${purpose}-hint`}>
                      {t(`purposes.${purpose}.without`)}
                    </FieldDescription>
                  </FieldContent>
                  <PurposeBadge purpose={purpose} />
                </Field>
              </div>
            ))}
          </fieldset>
          {missing && (
            <p role="alert" className="text-sm text-destructive">
              {t("dialog.platformMissing")}
            </p>
          )}
          {closing && <p className="text-xs text-muted-foreground">{closing}</p>}
        </div>
        <DialogFooter>
          <Button
            prominence="secondary"
            disabled={pending}
            onClick={() => {
              setChoices(everything);
              onSave(everything, "accept_all");
            }}
          >
            {t("acceptAll")}
          </Button>
          <Button
            pending={pending}
            onClick={() => {
              if (!choices.platform) {
                setMissing(true);
                return;
              }
              onSave(choices, "choose");
            }}
          >
            {t("dialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ConsentDialog };
