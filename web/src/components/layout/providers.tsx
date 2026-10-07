"use client";

import { useTranslations } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * What every page shares on the client, mounted once under the root layout: the theme, URL state for lists, one tooltip
 * delay for the whole application (the provider's default, never overridden per tooltip), and the
 * place toasts appear. A provider only some pages need belongs in the layout of those pages.
 */
function Providers({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Site");

  return (
    <ThemeProvider>
      <NuqsAdapter>
        <TooltipProvider>{children}</TooltipProvider>
      </NuqsAdapter>
      <Toaster position="top-right" duration={4000} containerAriaLabel={t("notifications")} />
    </ThemeProvider>
  );
}

export { Providers };
