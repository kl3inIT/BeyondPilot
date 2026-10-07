"use client";

import {
  ChevronsUpDownIcon,
  HouseIcon,
  LanguagesIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  SunMoonIcon,
} from "lucide-react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { AccountMenuPanel, type AccountMenuProps } from "@/components/layout/account-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

const themes = [
  { value: "light", icon: SunIcon },
  { value: "dark", icon: MoonIcon },
  { value: "system", icon: MonitorIcon },
] as const;

/**
 * What the admin menu offers in place of the site's pages: the way back to the site, and the
 * language and appearance, which the admin area has no header or footer to hold.
 */
function AdminAccountItems() {
  const t = useTranslations("Site.account");
  const languages = useTranslations("Site.language");
  const looks = useTranslations("Site.theme");
  const locale = useLocale();
  const active = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { theme = "light", setTheme } = useTheme();
  const look = themes.find((option) => option.value === theme)?.value ?? "light";

  function choose(locale: string) {
    if (hasLocale(routing.locales, locale)) {
      // The same page in the other language, with its filters and place in a list.
      startTransition(() =>
        router.replace(search ? `${pathname}?${search}` : pathname, { locale }),
      );
    }
  }

  return (
    <>
      <DropdownMenuItem render={<Link href={siteRoutes.home} />}>
        <HouseIcon aria-hidden="true" />
        {t("backToSite")}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <LanguagesIcon aria-hidden="true" />
          <span className="flex-1">{languages("label")}</span>
          <span className="text-muted-foreground">{languages(active)}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuRadioGroup value={active} onValueChange={choose}>
            {routing.locales.map((locale) => (
              <DropdownMenuRadioItem key={locale} value={locale} lang={locale}>
                {languages(locale)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SunMoonIcon aria-hidden="true" />
          <span className="flex-1">{t("appearance")}</span>
          <span className="text-muted-foreground">{looks(look)}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-48">
          <DropdownMenuRadioGroup value={look} onValueChange={setTheme}>
            {themes.map(({ value, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon aria-hidden="true" />
                {looks(value)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

/** The signed-in person at the foot of the admin sidebar, and the admin area's account menu. */
function AdminAccount({ name, email, operator }: AccountMenuProps) {
  const t = useTranslations("Site.account");
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" aria-label={t("open", { name: name ?? email })} />}
          >
            <Avatar>
              <AvatarFallback>{initials(name, email)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{name ?? email}</span>
              {name && <span className="truncate text-xs">{email}</span>}
            </div>
            <ChevronsUpDownIcon className="ml-auto" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
            className="w-66"
          >
            <AccountMenuPanel name={name} email={email} operator={operator}>
              <AdminAccountItems />
            </AccountMenuPanel>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export { AdminAccount };
