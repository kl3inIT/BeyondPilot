import { InboxIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { Status } from "@/components/composites/status";
import { OrganizationFrame } from "@/features/organization/organization-frame";
import { OrganizationSection } from "@/features/organization/organization-section";
import type {
  Introduction,
  MyOrganization,
  Organization,
  ReceivedIntroductions,
} from "@/lib/api/generated";

import { IntroductionActions } from "./introduction-actions";

type IntroductionsPageProps = {
  mine: MyOrganization & { organization: Organization };
  introductions: ReceivedIntroductions;
  /** How many members the organization has, for the tab beside this one. */
  members: number;
  /** How many solutions it lists, for the tab beside this one. */
  solutions: number;
  /** How many use cases it has, for the tab beside this one; null when it has no such tab. */
  useCases: number | null;
};

const tones = { pending: "warning", replied: "success", declined: "neutral" } as const;

/** One request: who asks, about which solution, what they wrote and where it stands. */
function IntroductionCard({
  introduction,
  editable,
}: {
  introduction: Introduction;
  editable: boolean;
}) {
  const t = useTranslations("Introduction.received");
  const format = useFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const sender = introduction.senderName
    ? t("sender", { name: introduction.senderName, organization: introduction.senderOrganization })
    : t("senderUnnamed", { organization: introduction.senderOrganization });

  return (
    <li className="flex flex-col gap-3 p-4 not-last:border-b">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-0.5 text-sm">
          <span className="font-medium">{sender}</span>
          <span className="text-muted-foreground">
            {t("about", { solution: introduction.solutionName })}
          </span>
        </div>
        <Status tone={tones[introduction.status]}>{t(`status.${introduction.status}`)}</Status>
      </div>
      <p className="text-sm whitespace-pre-line">{introduction.message}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{t("sent", { date: date(introduction.createdAt) })}</span>
        {introduction.status === "pending" && editable && (
          <IntroductionActions id={introduction.id} solutionName={introduction.solutionName} />
        )}
        {introduction.status === "replied" && introduction.senderEmail && (
          <span>{t("introduced", { email: introduction.senderEmail })}</span>
        )}
        {introduction.status !== "pending" && introduction.answeredAt && (
          <span>{t("answered", { date: date(introduction.answeredAt) })}</span>
        )}
      </div>
    </li>
  );
}

/**
 * My organization › Introductions: the requests people made for an introduction to the organization's
 * solutions. An owner replies, which shares both addresses, or declines; a member only reads. A
 * sender's address is shown only once the request was replied to.
 */
function IntroductionsPage({
  mine,
  introductions,
  members,
  solutions,
  useCases,
}: IntroductionsPageProps) {
  const t = useTranslations("Introduction.received");
  const waiting = introductions.items.filter((item) => item.status === "pending").length;

  return (
    <OrganizationFrame
      mine={mine}
      current="introductions"
      counts={{ members, solutions, useCases }}
    >
      <OrganizationSection
        id="introductions-list"
        title={t("title")}
        summary={waiting > 0 ? t("waiting", { count: waiting }) : undefined}
      >
        {introductions.items.length === 0 ? (
          <div className="rounded-lg border bg-background">
            <DataTableEmpty
              icon={<InboxIcon aria-hidden="true" />}
              title={t("empty.title")}
              description={t("empty.description")}
            />
          </div>
        ) : (
          <ul className="overflow-hidden rounded-lg border bg-background">
            {introductions.items.map((introduction) => (
              <IntroductionCard
                key={introduction.id}
                introduction={introduction}
                editable={introductions.editable}
              />
            ))}
          </ul>
        )}
        {!introductions.editable && introductions.items.length > 0 && (
          <p className="text-sm text-muted-foreground">{t("ownersAnswer")}</p>
        )}
      </OrganizationSection>
    </OrganizationFrame>
  );
}

export { IntroductionsPage };
