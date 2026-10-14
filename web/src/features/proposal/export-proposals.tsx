"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportUseCaseProposals } from "@/lib/api/generated";

/**
 * Downloads the proposals a use case received, the latest first, with their decisions. The backend records each download.
 */
function ExportProposals({ useCaseId, disabled }: { useCaseId: string; disabled: boolean }) {
  return (
    <ExportMenu
      name="use-case-proposals"
      disabled={disabled}
      download={(format) =>
        exportUseCaseProposals({ path: { useCaseId }, query: { format }, parseAs: "blob" })
      }
    />
  );
}

export { ExportProposals };
