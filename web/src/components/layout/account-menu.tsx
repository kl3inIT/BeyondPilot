"use client";

import {
  BuildingIcon,
  CableIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MessagesSquareIcon,
  UserRoundCogIcon,
  UserRoundIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@/i18n/navigation";
import { signOut } from "@/lib/auth/sign-out";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

type AccountMenuProps = {
  /** Null until the person or their provider gives a name: a code by email proves only the address. */
  name: string | null;
  email: string;
  operator: boolean;
  /** Whether they judge a program's applications, which their Reviews lead to. */
  reviewer?: boolean;
  /** How many messages they have not read and first messages wait for them, together. */
  waiting?: number;
};

/**
 * What an account menu holds, wherever it opens from: who is signed in, what the place it opens
 * from offers, and the way out. Signing out keeps the menu open while the request runs, and says
 * so there when it fails.
 */
function AccountMenuPanel({
  name,
  email,
  operator,
  children,
}: Omit<AccountMenuProps, "reviewer" | "waiting"> & { children: React.ReactNode }) {
  const t = useTranslations("Site.account");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");

  async function leave() {
    setState("pending");
    if (await signOut()) {
      // The page is rendered on the server from the session, so it is asked for again.
      router.refresh();
    } else {
      setState("failed");
    }
  }

  return (
    <>
      <div className="flex flex-col gap-0.5 px-1.5 py-2">
        {(name || operator) && (
          <div className="flex items-center gap-2">
            {name && <span className="truncate text-sm font-semibold">{name}</span>}
            {operator && <Badge variant="outline">{t("operator")}</Badge>}
          </div>
        )}
        <span className="truncate text-sm text-muted-foreground">{email}</span>
      </div>
      <DropdownMenuSeparator />
      {children}
      <DropdownMenuSeparator />
      <DropdownMenuItem closeOnClick={false} disabled={state === "pending"} onClick={leave}>
        {state === "pending" ? <Spinner /> : <LogOutIcon aria-hidden="true" />}
        {t("signOut")}
      </DropdownMenuItem>
      {state === "failed" && (
        <p role="alert" className="px-1.5 py-1 text-sm text-destructive">
          {t("signOutFailed")}
        </p>
      )}
    </>
  );
}

/** What the site's menu offers: the person's own pages, and the admin area for an operator. */
function SiteAccountItems({
  operator,
  reviewer = false,
  waiting = 0,
}: {
  operator: boolean;
  reviewer?: boolean;
  waiting?: number;
}) {
  const t = useTranslations("Site.account");

  return (
    <>
      <DropdownMenuItem render={<Link href={siteRoutes.myApplications} />}>
        <FileTextIcon aria-hidden="true" />
        {t("applications")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={siteRoutes.workspaceOrganization} />}>
        <BuildingIcon aria-hidden="true" />
        {t("organization")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={siteRoutes.talentProfile} />}>
        <UserRoundIcon aria-hidden="true" />
        {t("talentProfile")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={siteRoutes.messages} />}>
        <MessagesSquareIcon aria-hidden="true" />
        {t("messages")}
        {waiting > 0 && (
          <Badge className="ml-auto">
            <span aria-hidden="true">{waiting}</span>
            <span className="sr-only">{t("messagesWaiting", { count: waiting })}</span>
          </Badge>
        )}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={siteRoutes.account} />}>
        <UserRoundCogIcon aria-hidden="true" />
        {t("settings")}
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href={siteRoutes.accountMcp} />}>
        <CableIcon aria-hidden="true" />
        {t("mcp")}
      </DropdownMenuItem>
      {reviewer && (
        <DropdownMenuItem render={<Link href={siteRoutes.reviews} />}>
          <ClipboardCheckIcon aria-hidden="true" />
          {t("reviews")}
        </DropdownMenuItem>
      )}
      {operator && (
        <DropdownMenuItem render={<Link href={siteRoutes.admin} />}>
          <LayoutDashboardIcon aria-hidden="true" />
          {t("admin")}
        </DropdownMenuItem>
      )}
    </>
  );
}

/** The signed-in person's place in the header: an avatar that opens their account menu. */
function AccountMenu({ name, email, operator, reviewer, waiting = 0 }: AccountMenuProps) {
  const t = useTranslations("Site.account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={
              waiting > 0
                ? t("openWaiting", { name: name ?? email, count: waiting })
                : t("open", { name: name ?? email })
            }
            className="hit-area rounded-full text-sm transition-shadow outline-none hover:ring-1 hover:ring-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:ring-1 data-popup-open:ring-ring"
          />
        }
      >
        <Avatar className="size-9">
          <AvatarFallback variant="accent">{initials(name, email)}</AvatarFallback>
          {/* The count is in the menu, next to Messages; here a mark says that something waits,
              and the name of the button says how much. */}
          {waiting > 0 && <AvatarBadge aria-hidden="true" className="top-0 bottom-auto" />}
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-66">
        <AccountMenuPanel name={name} email={email} operator={operator}>
          <SiteAccountItems operator={operator} reviewer={reviewer} waiting={waiting} />
        </AccountMenuPanel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu, AccountMenuPanel };
export type { AccountMenuProps };
