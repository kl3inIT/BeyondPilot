import { useTranslations } from "next-intl";

import { useCountryName } from "@/i18n/vocabulary";
import type { SentBy } from "@/lib/api/generated";

import { Card, Rows } from "./proposal-card";

type ProposalSentByProps = {
  sentBy: SentBy;
  title: string;
};

/** The submitting identity as lines: the name, address, country and number the sender gave. */
function SentByRows({ sentBy }: { sentBy: SentBy }) {
  const t = useTranslations("UseCaseProposal.wizard.details");
  const countryName = useCountryName();

  return (
    <Rows
      rows={[
        { label: t("name"), value: sentBy.name },
        { label: t("email"), value: sentBy.email },
        { label: t("country"), value: sentBy.country && countryName(sentBy.country) },
        { label: t("phone"), value: sentBy.phone },
      ].filter((row) => row.value)}
    />
  );
}

/** Who sent the proposal: the account's name, address, country and number. */
function ProposalSentBy({ sentBy, title }: ProposalSentByProps) {
  return (
    <Card id="proposal-sent-by" title={title}>
      <SentByRows sentBy={sentBy} />
    </Card>
  );
}

export { ProposalSentBy, SentByRows };
