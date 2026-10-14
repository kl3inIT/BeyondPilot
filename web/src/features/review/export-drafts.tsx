"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportProgramDrafts } from "@/lib/api/generated";

/**
 * Downloads a program's drafts not submitted yet, with their applicants' contact details and how far they got, to write to them outside BeyondPilot. The backend records each download.
 */
function ExportDrafts({ programId, disabled }: { programId: string; disabled: boolean }) {
  return (
    <ExportMenu
      name="drafts"
      disabled={disabled}
      download={(format) =>
        exportProgramDrafts({ path: { programId }, query: { format }, parseAs: "blob" })
      }
    />
  );
}

export { ExportDrafts };
