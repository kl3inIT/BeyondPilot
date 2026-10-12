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

import { Button } from "@/components/actions/button";

import { ClaimDecision } from "./claim-decision";
import { useReviewQueue } from "./organization-review-queue";

/**
 * What an operator can do with one organization, at the end of its row: Review, in view, on one
 * that waits for a decision, which is what the list is for; and in a menu, deciding the claim to
 * own one and opening its record. The review itself belongs to the list, which goes on to the next
 * organization that waits.
 */
function AdminOrganizationRowActions({ organization }: { organization: AdminOrganizationSummary }) {
  const t = useTranslations("Admin.organizations.actions");
  const review = useReviewQueue();
  const [deciding, setDeciding] = useState(false);
  const { claimId } = organization;

  return (
    <>
      {review && organization.status === "in_review" && (
        <Button
          size="sm"
          prominence="secondary"
          aria-label={t("reviewNamed", { name: organization.name })}
          onClick={() => review(organization.id)}
        >
          <ClipboardCheckIcon aria-hidden="true" />
          <span className="max-md:sr-only">{t("review")}</span>
        </Button>
      )}
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
