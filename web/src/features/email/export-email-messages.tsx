"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportEmailMessages, type ExportEmailMessagesData } from "@/lib/api/generated";

/**
 * Downloads the email log as the screen narrows it, every page of it, newest first; a sign-in
 * code's subject is withheld. The backend records each download.
 */
function ExportEmailMessages({
  filters,
  disabled,
}: {
  filters: Omit<
    NonNullable<ExportEmailMessagesData["query"]>,
    "format" | "before" | "after" | "size"
  >;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="emails"
      disabled={disabled}
      download={(format) => exportEmailMessages({ query: { ...filters, format }, parseAs: "blob" })}
    />
  );
}

export { ExportEmailMessages };
