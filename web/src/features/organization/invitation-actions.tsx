"use client";

import { EllipsisIcon, MailXIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { revokeOrganizationInvitation, type OrganizationInvitation } from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

/** What an owner can do to an invitation that waits for an answer, in a menu at the end of its row. */
function InvitationActions({ invitation }: { invitation: OrganizationInvitation }) {
  const t = useTranslations("Organization.members.actions");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  // The page shows the change once it has read it again; until then the action cannot be repeated.
  const [refreshing, startRefresh] = useTransition();

  async function revoke() {
    setPending(true);
    try {
      await revokeOrganizationInvitation({ path: { id: invitation.id } });
      notify.success("Organization.done.invitationRevoked");
      startRefresh(() => router.refresh());
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t("openInvitation", { email: invitation.email })}
            disabled={pending || refreshing}
            className="hit-area flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
          />
        }
      >
        <EllipsisIcon className="size-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem variant="destructive" onClick={revoke}>
            <MailXIcon aria-hidden="true" />
            {t("revoke")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { InvitationActions };
