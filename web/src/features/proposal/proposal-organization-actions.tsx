"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import type { ProposingOrganization } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { ProposalOrganizationDialog } from "./proposal-organization-dialog";

/**
 * What a proposal's organization offers beside its name: its owner corrects what they gave, whichever
 * type it is (a person on their own too), and anyone reads and changes the rest in My organization,
 * which opens apart so that the proposal is kept as it stands.
 */
function ProposalOrganizationActions({
  organization,
  onSaved,
}: {
  organization: ProposingOrganization;
  onSaved: () => Promise<void>;
}) {
  const t = useTranslations("UseCaseProposal.wizard.organization");
  const account = useTranslations("Site.account");
  const [editing, setEditing] = useState(false);

  return (
    <>
      {organization.owner && (
        <>
          <TextButton onClick={() => setEditing(true)}>{t("edit")}</TextButton>
          <ProposalOrganizationDialog open={editing} onOpenChange={setEditing} onSaved={onSaved} />
        </>
      )}
      <TextButton href={siteRoutes.workspaceOrganization} target="_blank" rel="noreferrer">
        {account("organization")}
      </TextButton>
    </>
  );
}

export { ProposalOrganizationActions };
