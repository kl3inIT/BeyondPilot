"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { saveUseCaseProposal } from "@/lib/api/generated";

import { describeProposalError } from "./proposal-errors";

type ProposalSaveLaterProps = {
  useCaseId: string;
};

/**
 * Keeps an empty draft of a proposal for this use case, so it waits in the person's drafts. The
 * server makes the working copy; what goes in it is filled in the form.
 */
function ProposalSaveLater({ useCaseId }: ProposalSaveLaterProps) {
  const t = useTranslations("UseCases.detail.open");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    try {
      await saveUseCaseProposal({
        path: { useCaseId },
        body: { solutionIds: [], team: [], version: null },
      });
      notify.success("UseCaseProposal.actions.saved");
      // The page reads the draft again: it now offers to continue it.
      router.refresh();
    } catch (error) {
      notify.error(describeProposalError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      className="w-full"
      prominence="secondary"
      size="lg"
      pending={pending}
      onClick={() => void save()}
    >
      {t("save")}
    </Button>
  );
}

export { ProposalSaveLater };
