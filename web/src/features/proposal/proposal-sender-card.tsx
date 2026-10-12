import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { SenderProfile } from "@/lib/api/generated";

import { Card, Rows } from "./proposal-card";

/** What a sender's profile shows, each with its label; the review and the proposal as read draw the same lines. */
function useSenderRows(
  sender: Pick<
    SenderProfile,
    | "name"
    | "headline"
    | "bio"
    | "roles"
    | "skills"
    | "country"
    | "city"
    | "worksAt"
    | "languages"
    | "industries"
    | "engagement"
    | "website"
  > & { email?: string | null },
) {
  const t = useTranslations("UseCaseProposal.received.detail");
  const view = useTranslations("Talent.view");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const countryName = useCountryName();
  const place = [sender.city, sender.country && countryName(sender.country)]
    .filter(Boolean)
    .join(", ");
  return [
    { label: t("sender.name"), value: sender.name },
    { label: t("sender.headline"), value: sender.headline },
    { label: view("roles"), value: sender.roles.map(role).join(", ") },
    { label: view("skills"), value: sender.skills.join(", ") },
    { label: view("about"), value: sender.bio },
    {
      label: view("place"),
      value: [place, sender.worksAt].filter(Boolean).join(" · "),
    },
    { label: view("industries"), value: sender.industries.map(industry).join(", ") },
    { label: view("languages"), value: sender.languages.map(language).join(", ") },
    { label: view("engagement"), value: sender.engagement.map(engagement).join(", ") },
    {
      label: view("website"),
      value: sender.website && (
        <TextButton href={sender.website} target="_blank" rel="noreferrer">
          {sender.website}
        </TextButton>
      ),
    },
    { label: t("sender.email"), value: sender.email },
  ].filter((row) => row.value);
}

type ProposalSenderCardProps = {
  sender: SenderProfile;
  title: string;
};

/** The sender's talent profile as it was when the proposal was sent. */
function ProposalSenderCard({ sender, title }: ProposalSenderCardProps) {
  const rows = useSenderRows(sender);

  return (
    <Card id="proposal-sender" title={title}>
      <Rows rows={rows} />
      {sender.projects.length > 0 && (
        <ul className="flex flex-col gap-3 border-t pt-4">
          {sender.projects.map((project) => (
            <li key={project.title} className="grid text-sm">
              <span className="font-medium">
                {project.title}
                {project.year ? ` · ${project.year}` : ""}
              </span>
              {project.summary && <span className="text-muted-foreground">{project.summary}</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** The lines of a profile, as the review and the step draw them. */
function ProfileRows({ profile }: { profile: Parameters<typeof useSenderRows>[0] }) {
  return <Rows rows={useSenderRows(profile)} />;
}

export { ProfileRows, ProposalSenderCard };
