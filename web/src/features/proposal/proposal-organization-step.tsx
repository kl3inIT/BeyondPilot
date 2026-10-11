import { useTranslations } from "next-intl";

import { Status } from "@/components/composites/status";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ProposingOrganization } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

/** The organization the proposal is sent for: read only, it is the caller's own. */
function ProposalOrganizationStep({ organization }: { organization: ProposingOrganization }) {
  const t = useTranslations("UseCaseProposal.wizard.organization");

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <Avatar size="lg">
        {organization.logoFileId && (
          <AvatarImage src={publicFileUrl(organization.logoFileId)} alt="" />
        )}
        <AvatarFallback>{initials(organization.name, "")}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-base font-medium">{organization.name}</span>
        <Status tone="success">{t("approved")}</Status>
      </div>
    </div>
  );
}

export { ProposalOrganizationStep };
