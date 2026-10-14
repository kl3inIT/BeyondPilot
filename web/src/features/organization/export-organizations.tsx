"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminOrganizations, type ExportAdminOrganizationsData } from "@/lib/api/generated";

/**
 * Downloads the organizations as the list is narrowed, every page of it. The backend records each download.
 */
function ExportOrganizations({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAdminOrganizationsData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="organizations"
      disabled={disabled}
      download={(format) =>
        exportAdminOrganizations({ query: { ...filters, format }, parseAs: "blob" })
      }
    />
  );
}

export { ExportOrganizations };
