"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminSolutions, type ExportAdminSolutionsData } from "@/lib/api/generated";

/**
 * Downloads the solutions as the list is narrowed, every page of it. The backend records each download.
 */
function ExportSolutions({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAdminSolutionsData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="solutions"
      disabled={disabled}
      download={(format) =>
        exportAdminSolutions({ query: { ...filters, format }, parseAs: "blob" })
      }
    />
  );
}

export { ExportSolutions };
