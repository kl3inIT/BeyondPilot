"use client";

import { cn } from "cn";
import Image from "next/image";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function Flag({ locale }: { locale: string }) {
  return (
    <Image
      src={`/flags/${locale}.svg`}
      alt=""
      width={20}
      height={20}
      className="size-5 rounded-full ring-1 ring-border"
    />
  );
}

/**
 * The header's language choice: the current flag and code, opening a menu of every language in
 * its own name. Choosing one opens the current page in that language.
 */
function LanguageMenu({ className }: { className?: string }) {
  const t = useTranslations("Site.language");
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function choose(locale: string) {
    if (hasLocale(routing.locales, locale)) {
      startTransition(() => router.replace(pathname, { locale }));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "hit-area flex h-9 items-center gap-2 rounded-full px-2 text-sm font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-accent",
              className,
            )}
          />
        }
      >
        <Flag locale={active} />
        <span className="sr-only">{t("label")}: </span>
        <span className="max-md:sr-only">{active.toUpperCase()}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-50">
        <DropdownMenuRadioGroup value={active} onValueChange={choose}>
          {routing.locales.map((locale) => (
            <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
              <Flag locale={locale} />
              {t(locale)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { LanguageMenu };
