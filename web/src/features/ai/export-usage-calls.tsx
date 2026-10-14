"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAiUsageCalls, type ExportAiUsageCallsData } from "@/lib/api/generated";

/**
 * Downloads the log of calls as it is narrowed, every page of it. The backend records each download.
 */
function ExportUsageCalls({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAiUsageCallsData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="ai-calls"
      disabled={disabled}
      download={(format) => exportAiUsageCalls({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportUsageCalls };
