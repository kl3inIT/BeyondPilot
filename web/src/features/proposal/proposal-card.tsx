import { useTranslations } from "next-intl";

import { DataTableRows } from "@/components/composites/data-table-view";
import { Badge } from "@/components/ui/badge";
import type { ProposalTeamMember } from "@/lib/api/generated";

type CardProps = {
  id: string;
  title: string;
  children: React.ReactNode;
};

/** One titled card of a proposal, as read. */
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

/** The people a proposal names with their roles: a table from 768px, stacked rows below. */
function ProposalTeamList({ team }: { team: ProposalTeamMember[] }) {
  const t = useTranslations("UseCaseProposal.received.detail.team");
  const people = team.map((member) => {
    const name = member.name?.trim() || null;
    return {
      id: member.accountId,
      who: (
        <div className="grid min-w-0 text-sm">
          <span className="truncate font-medium">{name ?? member.email}</span>
          {name && <span className="truncate text-muted-foreground">{member.email}</span>}
        </div>
      ),
      role: <span className="text-sm">{member.role}</span>,
      primary: member.primary ? <Badge variant="secondary">{t("primary")}</Badge> : null,
    };
  });

  return (
    <>
      {/* From 768px: a table. */}
      <DataTableRows
        className="hidden md:flex"
        columns={[
          { id: "person", header: t("person"), layout: { fill: true } },
          { id: "role", header: t("role") },
          {
            id: "primary",
            header: <span className="sr-only">{t("primary")}</span>,
            layout: { width: "md" },
          },
        ]}
        rows={people.map((person) => ({
          id: person.id,
          cells: { person: person.who, role: person.role, primary: person.primary },
        }))}
      />
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
    </>
  );
}

export { Card, ProposalTeamList, Rows };
