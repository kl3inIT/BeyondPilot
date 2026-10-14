import { InboxIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { DataTableRows } from "@/components/composites/data-table-view";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { useFormatter } from "@/i18n/format";
import type { AccountSummary, ProgramConversationAssignment } from "@/lib/api/generated";

import { ProgramAssignmentAction } from "./program-assignment-action";

export function AdminProgramAssignmentsPage({
  assignments,
  operators,
}: {
  assignments: ProgramConversationAssignment[];
  operators: AccountSummary[];
}) {
  const t = useTranslations("Messaging.assignments");
  const format = useFormatter();
  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader destination="programMessages" title={t("title")} lead={t("lead")} />
      <DataTableRows
        columns={[
          { id: "program", header: t("program"), layout: { fill: true } },
          { id: "created", header: t("created") },
          { id: "assignee", header: t("assignee") },
          { id: "action", header: t("assign") },
        ]}
        rows={assignments.map((assignment) => ({
          id: assignment.id,
          cells: {
            program: assignment.programName,
            created: format.dateTime(new Date(assignment.createdAt), "date"),
            assignee:
              operators.find((operator) => operator.id === assignment.assigneeId)?.displayName ??
              operators.find((operator) => operator.id === assignment.assigneeId)?.email ??
              t(assignment.assigneeId ? "unavailable" : "unassigned"),
            action: <ProgramAssignmentAction id={assignment.id} operators={operators} />,
          },
        }))}
        empty={
          assignments.length === 0 ? (
            <DataTableEmpty icon={<InboxIcon aria-hidden="true" />} title={t("empty")} />
          ) : null
        }
      />
    </div>
  );
}
