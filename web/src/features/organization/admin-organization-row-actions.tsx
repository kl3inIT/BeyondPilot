"use client";

import { ClipboardCheckIcon, FileTextIcon, KeyRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
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
        <RowMenuTrigger aria-label={t("open", { name: organization.name })} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            {organization.status === "in_review" && (
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
