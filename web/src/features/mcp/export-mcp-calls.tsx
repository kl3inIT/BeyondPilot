"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportMcpCalls, type ExportMcpCallsData } from "@/lib/api/generated";

/** Downloads the calls as the screen narrows them, every page of it, newest first. The backend records each download. */
function ExportMcpCalls({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportMcpCallsData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="mcp-calls"
      disabled={disabled}
      download={(format) => exportMcpCalls({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportMcpCalls };
