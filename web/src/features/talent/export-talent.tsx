"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminTalent, type ExportAdminTalentData } from "@/lib/api/generated";

/**
 * Downloads the talent profiles as the list is narrowed, every page of it, with their people's email. The backend records each download.
 */
function ExportTalent({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAdminTalentData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="talent"
      disabled={disabled}
      download={(format) => exportAdminTalent({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportTalent };
