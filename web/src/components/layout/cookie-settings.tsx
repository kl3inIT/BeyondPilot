"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CookiePreferences } from "@/components/layout/cookie-consent";
import { usePublicSite } from "@/components/layout/use-public-site";

/**
 * The way back to the cookie choice, in the footer's small print: a visitor can give consent or
 * take it back at any time. It shows where the choice means something, on the public address.
 */
function CookieSettings({ className }: { className?: string }) {
  const t = useTranslations("Site.cookies");
  const live = usePublicSite();
  const [open, setOpen] = useState(false);

  if (!live) {
    return null;
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {t("settings")}
      </button>
      <CookiePreferences open={open} onOpenChange={setOpen} />
    </>
  );
}

export { CookieSettings };
