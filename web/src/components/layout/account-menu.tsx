"use client";

import { LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/lib/auth/sign-out";
import { initials } from "@/lib/initials";

type AccountMenuProps = {
  /** Null until the person or their provider gives a name: a code by email proves only the address. */
  name: string | null;
  email: string;
  operator: boolean;
};

/**
 * What an account menu holds, wherever it opens from: who is signed in and the way out. Signing
 * out keeps the menu open while the request runs, and says so there when it fails.
 */
function AccountMenuPanel({ name, email, operator }: AccountMenuProps) {
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

/** The signed-in person's place in the header: an avatar that opens their account menu. */
function AccountMenu({ name, email, operator }: AccountMenuProps) {
  const t = useTranslations("Site.account");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("open", { name: name ?? email })}
            className="hit-area flex size-9 items-center justify-center rounded-full border bg-accent text-sm font-semibold text-primary transition-colors outline-none hover:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-ring"
          />
        }
      >
        {initials(name, email)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-66">
        <AccountMenuPanel name={name} email={email} operator={operator} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { AccountMenu, AccountMenuPanel };
export type { AccountMenuProps };
