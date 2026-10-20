"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminUseCases, type ExportAdminUseCasesData } from "@/lib/api/generated";

/** Downloads the use cases as the list is narrowed, every page of it. The backend records each download. */
function ExportUseCases({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAdminUseCasesData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="use-cases"
      disabled={disabled}
      download={(format) => exportAdminUseCases({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportUseCases };
