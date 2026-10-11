import { ArrowUpRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { OrganizationMark } from "@/features/organization/organization-mark";
import { Link } from "@/i18n/navigation";
import type { ProposalSolution, SolutionSummary } from "@/lib/api/generated";
import { sharedSolutionRoute, solutionRoute } from "@/lib/site";

type ProposalSolutionRowProps = {
  name: string;
  summary?: string | null;
  /** The solution's logo, or its organization's; without one the mark holds initials. */
  logoFileId?: string | null;
  /** Where the solution opens, in a new tab; without it the row is plain. */
  href?: string;
};

/** One solution of a proposal: its image, its name and what it does. A link opens in a new tab. */
function ProposalSolutionRow({ name, summary, logoFileId, href }: ProposalSolutionRowProps) {
  const t = useTranslations("UseCaseProposal.solutionList");
  const body = (
    <>
      <OrganizationMark name={name} logoFileId={logoFileId} />
      <span className="grid min-w-0 flex-1 text-sm">
        <span className="truncate font-medium">{name}</span>
        {summary && <span className="line-clamp-2 text-muted-foreground">{summary}</span>}
      </span>
    </>
  );
  if (!href) {
    return <div className="flex items-center gap-3 rounded-lg border p-3">{body}</div>;
  }
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener"
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {body}
      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("newTab")}</span>
    </Link>
  );
}

/**
 * The solutions a proposal offers, as cards. Each opens in a new tab: its public page once it is
 * approved, and otherwise its page for whoever holds the link.
 */
function ProposalSolutionList({ solutions }: { solutions: ProposalSolution[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {solutions.map((solution) => (
        <li key={solution.id}>
          <ProposalSolutionRow
            name={solution.name}
            summary={solution.summary}
            logoFileId={solution.logoFileId}
            href={
              solution.slug ? solutionRoute(solution.slug) : sharedSolutionRoute(solution.viewKey)
            }
          />
        </li>
      ))}
    </ul>
  );
}

/** What the row of a solution of the organization's own list holds, read before the proposal is sent. */
function catalogRowProps(solution: SolutionSummary, organizationLogoFileId?: string | null) {
  return {
    name: solution.name,
    summary: solution.summary,
    logoFileId: solution.logoFileId ?? organizationLogoFileId,
  };
}

/** Where a solution of the organization's own list opens: its public page once approved and not taken down. */
function catalogHref(solution: SolutionSummary) {
  return solution.status === "approved" && !solution.suspendedAt
    ? solutionRoute(solution.slug)
    : sharedSolutionRoute(solution.viewKey);
}

export { catalogHref, catalogRowProps, ProposalSolutionList, ProposalSolutionRow };
