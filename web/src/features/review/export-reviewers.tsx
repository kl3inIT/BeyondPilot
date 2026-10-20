"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportReviewers } from "@/lib/api/generated";

/**
 * Downloads who scores a program's applications: the operators who scored, then the judges in the
 * order they were invited. The backend records each download on the program.
 */
function ExportReviewers({ programId, disabled }: { programId: string; disabled: boolean }) {
  return (
    <ExportMenu
      name="reviewers"
      disabled={disabled}
      download={(format) =>
        exportReviewers({ path: { programId }, query: { format }, parseAs: "blob" })
      }
    />
  );
}

export { ExportReviewers };
