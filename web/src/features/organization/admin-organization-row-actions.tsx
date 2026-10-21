"use client";

import { FileTextIcon, KeyRoundIcon } from "lucide-react";
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

/**
 * What an operator can do with one organization, in a menu at the end of its row: decide the claim
 * to own it, and open its record.
 */
function AdminOrganizationRowActions({ organization }: { organization: AdminOrganizationSummary }) {
  const t = useTranslations("Admin.organizations.actions");
  const [deciding, setDeciding] = useState(false);
  const { claimId } = organization;

  return (
    <>
      <DropdownMenu>
        <RowMenuTrigger aria-label={t("open", { name: organization.name })} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
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
