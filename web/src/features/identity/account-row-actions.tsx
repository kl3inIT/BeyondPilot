"use client";

import {
  BanIcon,
  CircleCheckIcon,
  EllipsisIcon,
  MailIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Person } from "@/components/composites/person";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify, type MessageKey } from "@/hooks/use-notify";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/api/client";
import {
  disableAccount,
  enableAccount,
  grantOperator,
  withdrawOperator,
  type AccountSummary,
} from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

/** The changes an operator confirms first; enabling an account is the undo and happens at once. */
type Confirmed = "disable" | "makeOperator" | "withdrawOperator";

/** One change of an account: the call that makes it, and the words that say it was made. */
type Change = { run: (id: string) => Promise<unknown>; done: MessageKey };

const enable: Change = {
  run: (id) => enableAccount({ path: { id } }),
  done: "Admin.accounts.done.enabled",
};

const confirmed: Record<Confirmed, Change & { tone: "default" | "danger" }> = {
  disable: {
    run: (id) => disableAccount({ path: { id } }),
    done: "Admin.accounts.done.disabled",
    tone: "danger",
  },
  makeOperator: {
    run: (id) => grantOperator({ path: { id } }),
    done: "Admin.accounts.done.operatorGranted",
    tone: "default",
  },
  withdrawOperator: {
    run: (id) => withdrawOperator({ path: { id } }),
    done: "Admin.accounts.done.operatorWithdrawn",
    tone: "danger",
  },
};

/** The refusals this screen can meet, each with its own words; anything else gets the general ones. */
const refusals: Record<string, MessageKey> = {
  IDENTITY_OWN_ACCOUNT: "Admin.accounts.errors.ownAccount",
  IDENTITY_OPERATOR_CONFIGURED: "Admin.accounts.errors.operatorConfigured",
  IDENTITY_ACCOUNT_NOT_FOUND: "Admin.accounts.errors.accountNotFound",
  IDENTITY_OPERATOR_REQUIRED: "Admin.accounts.errors.operatorRequired",
};

/**
 * What an operator can do to one account, in a menu at the end of its row. A change that is hard to
 * take back asks first; after any change the list is read again, so the row shows what the backend
 * now holds.
 */
function AccountRowActions({ account }: { account: AccountSummary }) {
  const t = useTranslations("Admin.accounts");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<Confirmed | null>(null);
  const [pending, setPending] = useState(false);

  const name = account.displayName ?? account.email;
  const disabled = account.status === "disabled";
  const operator = account.role === "operator";

  async function change({ run, done }: Change) {
    setPending(true);
    try {
      await run(account.id);
      notify.success(done, { name });
      router.refresh();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error((code && refusals[code]) || "Admin.accounts.errors.unknown");
    } finally {
      setPending(false);
      setAsking(null);
    }
  }

  const confirmations = {
    disable: {
      title: t("confirm.disable.title"),
      description: t("confirm.disable.note"),
      confirmLabel: t("confirm.disable.confirm"),
    },
    makeOperator: {
      title: t("confirm.makeOperator.title", { name }),
      description: t("confirm.makeOperator.note"),
      confirmLabel: t("confirm.makeOperator.confirm"),
    },
    withdrawOperator: {
      title: t("confirm.withdrawOperator.title"),
      description: t("confirm.withdrawOperator.note"),
      confirmLabel: t("confirm.withdrawOperator.confirm"),
    },
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("actions.open", { name })}
              disabled={pending}
              className="hit-area flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem
              render={
                <Link
                  href={`${siteRoutes.adminEmailActivity}?period=all&q=${encodeURIComponent(account.email)}`}
                />
              }
            >
              <MailIcon aria-hidden="true" />
              {t("actions.emails")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {operator && !account.configuredOperator && (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setAsking("withdrawOperator")}>
                <ShieldOffIcon aria-hidden="true" />
                {t("actions.withdrawOperator")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {!operator && (
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setAsking("makeOperator")}>
                <ShieldCheckIcon aria-hidden="true" />
                {t("actions.makeOperator")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          )}
          {!(operator && account.configuredOperator) && <DropdownMenuSeparator />}
          <DropdownMenuGroup>
            {disabled ? (
              <DropdownMenuItem onClick={() => change(enable)}>
                <CircleCheckIcon aria-hidden="true" />
                {t("actions.enable")}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => setAsking("disable")}>
                <BanIcon aria-hidden="true" />
                {t("actions.disable")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {asking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setAsking(null)}
          {...confirmations[asking]}
          cancelLabel={t("confirm.cancel")}
          tone={confirmed[asking].tone}
          pending={pending}
          onConfirm={() => change(confirmed[asking])}
        >
          <div className="rounded-lg border bg-muted p-3">
            <Person name={account.displayName ?? null} email={account.email} />
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}

export { AccountRowActions };
