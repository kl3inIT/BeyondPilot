"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportMatchingFeedback } from "@/lib/api/generated";

/** Downloads every answer that says a group is wrong, newest first. The backend records each download. */
function ExportMatchingFeedback({ disabled }: { disabled: boolean }) {
  return (
    <ExportMenu
      name="matching-feedback"
      disabled={disabled}
      download={(format) => exportMatchingFeedback({ query: { format }, parseAs: "blob" })}
    />
  );
}

export { ExportMatchingFeedback };
