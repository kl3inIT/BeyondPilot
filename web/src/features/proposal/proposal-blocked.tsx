import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { useCaseRoute } from "@/lib/site";

type ProposalBlockedProps = {
  useCaseId: string;
  reason: "own" | "closed";
};

/** Why a person cannot send a proposal for this use case, in place of the form. */
function ProposalBlocked({ useCaseId, reason }: ProposalBlockedProps) {
  const t = useTranslations("UseCaseProposal.wizard.blocked");

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 py-10 md:py-16">
      <div className="flex h-fit w-full max-w-2xl flex-col gap-6 rounded-3xl border bg-background p-6 md:p-10">
        <h1 className="text-3xl font-semibold tracking-tight">{t(`${reason}.title`)}</h1>
        <p className="text-base text-muted-foreground">{t(`${reason}.lead`)}</p>
        <div className="flex flex-wrap gap-3">
          <Button prominence="secondary" href={useCaseRoute(useCaseId)}>
            {t("backToUseCase")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ProposalBlocked };
