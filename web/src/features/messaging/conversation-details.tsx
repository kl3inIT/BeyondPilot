import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { ConversationParticipant, ConversationSubject } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

const pages = {
  talent: siteRoutes.talent,
  solution: siteRoutes.solutions,
  program: siteRoutes.programs,
} as const;

type ConversationDetailsProps = {
  subject: ConversationSubject;
  participants: ConversationParticipant[];
  /** Whether the reader wrote first or is the side written to. */
  side: "starter" | "recipient";
};

/**
 * What a conversation is about and who is in it, beside the messages: the profile, solution or
 * program with the way to its page, the facts a reader weighs the other side by, and who reads what
 * is written. Nothing here acts on the conversation.
 */
function ConversationDetails({ subject, participants, side }: ConversationDetailsProps) {
  const t = useTranslations("Messaging.details");
  const country = useCountryName();
  const industry = useVocabulary("industry");
  const maturity = useVocabulary("maturity");
  const role = useVocabulary("talentRole");
  const place = [subject.city, subject.country ? country(subject.country) : null]
    .filter(Boolean)
    .join(", ");
  const line =
    subject.kind === "talent"
      ? subject.headline
      : subject.kind === "solution" && subject.organizationName
        ? t("by", { organization: subject.organizationName })
        : subject.kind === "program"
          ? t("program")
          : null;
  const tags = [
    ...(subject.maturity ? [maturity(subject.maturity)] : []),
    ...subject.roles.map(role),
    ...subject.industries.map(industry),
  ];

  return (
    <div className="flex flex-col gap-4 p-5 text-sm">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback>{initials(subject.name, subject.name)}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0">
          <h2 className="font-medium break-words">{subject.name}</h2>
          {line && <p className="text-xs text-muted-foreground">{line}</p>}
        </div>
      </div>
      {subject.summary && <p className="line-clamp-5">{subject.summary}</p>}
      {tags.length > 0 && (
        <ul aria-label={t("tags")} className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag}>
              <Badge variant="outline">{tag}</Badge>
            </li>
          ))}
        </ul>
      )}
      {subject.slug ? (
        <Button
          prominence="secondary"
          size="sm"
          className="w-full"
          href={`${pages[subject.kind]}/${subject.slug}`}
        >
          {t(`view.${subject.kind}`)}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t("unlisted")}</p>
      )}
      {(place || subject.skills.length > 0 || subject.customerDeployments > 0) && (
        <>
          <Separator />
          <dl className="flex flex-col gap-3">
            {place && <Fact term={t("place")}>{place}</Fact>}
            {subject.skills.length > 0 && (
              <Fact term={t("skills")}>{subject.skills.join(", ")}</Fact>
            )}
            {subject.customerDeployments > 0 && (
              <Fact term={t("proof")}>
                {t("deployments", { count: subject.customerDeployments })}
              </Fact>
            )}
          </dl>
        </>
      )}
      <Separator />
      <section aria-labelledby="conversation-people" className="flex flex-col gap-3">
        <h3 id="conversation-people" className="font-medium">
          {t(side === "starter" ? "people.readers" : "people.writer")}
        </h3>
        {participants.length > 0 && (
          <ul className="flex flex-col gap-3">
            {participants.map((person, index) => {
              const name = person.name ?? t("someone");
              return (
                <li key={`${name}-${index}`} className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{initials(name, name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid min-w-0">
                    <span className="truncate font-medium">{name}</span>
                    {(person.organizationName || person.role !== "person") && (
                      <span className="truncate text-muted-foreground">
                        {[
                          person.organizationName,
                          person.role === "person" ? null : t(`role.${person.role}`),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          {side === "recipient" ? t("note.recipient") : t(`note.${subject.kind}`)}
        </p>
      </section>
    </div>
  );
}

function Fact({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid">
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export { ConversationDetails };
