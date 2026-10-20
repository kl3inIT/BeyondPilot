"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAccounts, type ExportAccountsData } from "@/lib/api/generated";

/** Downloads the accounts as the list is narrowed, every page of it. The backend records each download. */
function ExportAccounts({
  filters,
  disabled,
}: {
  filters: Omit<NonNullable<ExportAccountsData["query"]>, "format" | "page" | "size">;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="accounts"
      disabled={disabled}
      download={(format) => exportAccounts({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportAccounts };
