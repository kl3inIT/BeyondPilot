"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { saveConsent } from "@/lib/analytics-consent";
import { siteRoutes } from "@/lib/site";

type CookiePreferencesProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * The choice by kind of cookie. The ones the site needs to work cannot be refused; the measurement
 * of visits is off until the visitor turns it on.
 */
function CookiePreferences({ open, onOpenChange }: CookiePreferencesProps) {
  const t = useTranslations("Site.cookies.preferences");
  const id = useId();
  const [analytics, setAnalytics] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-120">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field orientation="horizontal">
            <Switch id={`${id}-necessary`} checked disabled />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor={`${id}-necessary`}>{t("necessary")}</FieldLabel>
              <FieldDescription>{t("necessaryHint")}</FieldDescription>
            </div>
          </Field>
          <Field orientation="horizontal">
            <Switch id={`${id}-analytics`} checked={analytics} onCheckedChange={setAnalytics} />
            <div className="flex flex-col gap-0.5">
              <FieldLabel htmlFor={`${id}-analytics`}>{t("analytics")}</FieldLabel>
              <FieldDescription>{t("analyticsHint")}</FieldDescription>
            </div>
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button onClick={() => saveConsent(analytics ? "granted" : "denied")}>{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Asks once whether the site may use cookies beyond the ones it needs to work; today that is the
 * measurement of visits. It stays along the bottom of the window, over the page, until the visitor
 * answers; nothing is measured before they accept.
 */
function CookieConsent() {
  const t = useTranslations("Site.cookies");
  const title = useId();
  const [customizing, setCustomizing] = useState(false);

  return (
    <section
      aria-labelledby={title}
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-background shadow-lg"
    >
      <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-5 py-4 md:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 xl:px-16 desktop:px-20">
        <div className="flex flex-col gap-1">
          <h2 id={title} className="text-base font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t.rich("message", {
              privacy: (chunks) => (
                <TextButton href={siteRoutes.privacy} className="whitespace-normal">
                  {chunks}
                </TextButton>
              ),
            })}
          </p>
        </div>
        <div className="flex shrink-0 flex-col-reverse gap-3 sm:flex-row">
          <Button prominence="secondary" onClick={() => setCustomizing(true)}>
            {t("customize")}
          </Button>
          <Button prominence="secondary" onClick={() => saveConsent("denied")}>
            {t("decline")}
          </Button>
          <Button onClick={() => saveConsent("granted")}>{t("accept")}</Button>
        </div>
      </div>
      <CookiePreferences open={customizing} onOpenChange={setCustomizing} />
    </section>
  );
}

export { CookieConsent };
