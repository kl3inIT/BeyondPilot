"use client";

import { ClipboardCheckIcon, EllipsisIcon, FileTextIcon, KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "@/i18n/navigation";
import type { AdminOrganizationSummary } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { ClaimDecision } from "./claim-decision";
import { OrganizationReview } from "./organization-review";

/**
 * What an operator can do with one organization, in a menu at the end of its row: review one that
 * waits for a decision, decide the claim to own one, and open its record.
 */
function AdminOrganizationRowActions({ organization }: { organization: AdminOrganizationSummary }) {
  const t = useTranslations("Admin.organizations.actions");
  const [reviewing, setReviewing] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const { claimId } = organization;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("open", { name: organization.name })}
              className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {organization.status === "pending" && (
              <DropdownMenuItem onClick={() => setReviewing(true)}>
                <ClipboardCheckIcon aria-hidden="true" />
                {t("review")}
              </DropdownMenuItem>
            )}
            {claimId && (
              <DropdownMenuItem onClick={() => setDeciding(true)}>
                <KeyRoundIcon aria-hidden="true" />
                {t("claim")}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              render={<Link href={`${siteRoutes.adminOrganizations}/${organization.id}`} />}
            >
              <FileTextIcon aria-hidden="true" />
              {t("record")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {reviewing && (
        <OrganizationReview organization={organization} onClose={() => setReviewing(false)} />
      )}
      {deciding && claimId && (
        <ClaimDecision
          organization={organization}
          claimId={claimId}
          onClose={() => setDeciding(false)}
        />
      )}
    </>
  );
}

export { AdminOrganizationRowActions };
