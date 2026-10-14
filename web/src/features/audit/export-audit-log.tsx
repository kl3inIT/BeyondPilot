"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAuditEvents, type ExportAuditEventsData } from "@/lib/api/generated";

/**
 * Downloads the audit log as it is narrowed, every page of it. The backend records each download.
 */
function ExportAuditLog({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAuditEventsData["query"]>, "format">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="audit-log"
      disabled={disabled}
      download={(format) => exportAuditEvents({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportAuditLog };
