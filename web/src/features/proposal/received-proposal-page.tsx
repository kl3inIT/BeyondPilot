import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { DataTable } from "@/components/composites/data-table";
import { ReviewStatus } from "@/components/composites/review-status";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFileSize } from "@/features/solution/solution-deck";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { ReceivedUseCaseProposal } from "@/lib/api/generated";
import { workspaceUseCaseProposalsRoute } from "@/lib/site";

import { proposalFileAddress } from "./received-proposals";

type ReceivedProposalPageProps = {
  proposal: ReceivedUseCaseProposal;
};

type CardProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

/** One titled card of the proposal. */
function Card({ id, title, children }: CardProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-xl border bg-background p-5 md:p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

type RowsProps = {
  rows: { label: string; value: React.ReactNode }[];
};

/** Label and value pairs, side by side from 640px and stacked below. */
function Rows({ rows }: RowsProps) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words whitespace-pre-line sm:col-span-3">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * One proposal a use case received, read-only: who sent it, the solutions offered and the approach,
 * the sender as they described themselves when they sent it, the team and the PDF. Shortlist and
 * Decline are drawn and disabled until a later change adds the decision.
 */
function ReceivedProposalPage({ proposal }: ReceivedProposalPageProps) {
  const t = useTranslations("UseCaseProposal.received.detail");
  const view = useTranslations("Talent.view");
  const format = useFormatter();
  const status = useVocabulary("reviewStatus");
  const role = useVocabulary("talentRole");
  const engagement = useVocabulary("engagement");
  const language = useVocabulary("language");
  const industry = useVocabulary("industry");
  const countryName = useCountryName();
  const size = useFileSize();
  const { sender, deck, team, solutions, useCase } = proposal;
  const sent = format.dateTime(new Date(proposal.sentAt), {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    timeZoneName: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  const place = sender
    ? [sender.city, sender.country && countryName(sender.country)].filter(Boolean).join(", ")
    : "";
  const senderRows = sender
    ? [
        { label: t("sender.name"), value: sender.name },
        { label: t("sender.headline"), value: sender.headline },
        { label: view("roles"), value: sender.roles.map(role).join(", ") },
        { label: view("skills"), value: sender.skills.join(", ") },
        { label: view("about"), value: sender.bio },
        { label: view("worksAt"), value: sender.worksAt },
        { label: view("place"), value: place },
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
      ].filter((row) => row.value)
    : [];
  const people = team.map((member) => ({
    id: member.accountId,
    who: (
      <div className="grid min-w-0 text-sm">
        <span className="truncate font-medium">{member.name ?? member.email}</span>
        {member.name && <span className="truncate text-muted-foreground">{member.email}</span>}
      </div>
    ),
    role: <span className="text-sm">{member.role}</span>,
    primary: member.primary ? <Badge variant="secondary">{t("team.primary")}</Badge> : null,
  }));

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-8 pb-16 md:px-8 md:pt-12">
      <div className="flex w-full max-w-220 flex-col gap-5">
        <div className="flex flex-col gap-2">
          <TextButton href={workspaceUseCaseProposalsRoute(useCase.id)} className="self-start">
            <ArrowLeftIcon aria-hidden="true" />
            {t("back")}
          </TextButton>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <OrganizationMark
                name={proposal.organizationName}
                logoFileId={proposal.organizationLogoFileId}
              />
              <h1 className="text-3xl font-semibold tracking-tight break-words">
                {proposal.organizationName}
              </h1>
            </div>
            {/* The decision comes with a later change: drawn, not offered. */}
            <div className="flex items-center gap-3">
              <Button prominence="secondary" disabled>
                {t("decline")}
              </Button>
              <Button disabled>{t("shortlist")}</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("meta", { useCase: useCase.title, sent })}
          </p>
        </div>

        <Card id="proposal-solutions" title={t("solutions.title")}>
          <ul className="flex flex-col divide-y">
            {solutions.map((solution) => (
              <li
                key={solution.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
              >
                <div className="grid min-w-0 text-sm">
                  <span className="font-medium">{solution.name}</span>
                  {solution.summary && (
                    <span className="text-muted-foreground">{solution.summary}</span>
                  )}
                </div>
                <ReviewStatus state={solution.status} appearance="pill">
                  {status(solution.status)}
                </ReviewStatus>
              </li>
            ))}
          </ul>
          <Rows
            rows={[
              {
                label: t("solutions.approach"),
                value: proposal.approach || (
                  <span className="text-muted-foreground">{t("solutions.noApproach")}</span>
                ),
              },
            ]}
          />
        </Card>

        {sender && (
          <Card id="proposal-sender" title={t("sender.title")}>
            <Rows rows={senderRows} />
            {sender.projects.length > 0 && (
              <ul className="flex flex-col gap-3 border-t pt-4">
                {sender.projects.map((project) => (
                  <li key={project.title} className="grid text-sm">
                    <span className="font-medium">
                      {project.title}
                      {project.year ? ` · ${project.year}` : ""}
                    </span>
                    {project.summary && (
                      <span className="text-muted-foreground">{project.summary}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        <Card id="proposal-team" title={t("team.title")}>
          {/* From 768px: a table. */}
          <DataTable className="hidden md:block">
            <TableHeader>
              <TableRow>
                <TableHead>{t("team.person")}</TableHead>
                <TableHead>{t("team.role")}</TableHead>
                <TableHead className="w-36">
                  <span className="sr-only">{t("team.primary")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="max-w-0">{person.who}</TableCell>
                  <TableCell>{person.role}</TableCell>
                  <TableCell>{person.primary}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
          {/* Below 768px: stacked, never a table scrolled sideways. */}
          <ul className="flex flex-col divide-y md:hidden">
            {people.map((person) => (
              <li key={person.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                {person.who}
                <div className="flex flex-wrap items-center gap-2">
                  {person.role}
                  {person.primary}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card id="proposal-file" title={t("file.title")}>
          {deck ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid min-w-0 text-sm">
                <span className="truncate font-medium">{deck.fileName}</span>
                <span className="text-muted-foreground">{size(deck.sizeBytes)}</span>
              </div>
              <TextButton href={proposalFileAddress(proposal.id)}>
                <DownloadIcon aria-hidden="true" />
                {t("file.download")}
              </TextButton>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("file.none")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

export { ReceivedProposalPage };
