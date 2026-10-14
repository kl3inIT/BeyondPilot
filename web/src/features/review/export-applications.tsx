"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportReviewApplications } from "@/lib/api/generated";

/**
 * Downloads a program's applications, the ones the list shows, with their applicants' contact details. The backend records each download.
 */
function ExportApplications({
  programId,
  applicationIds,
  disabled,
}: {
  programId: string;
  /** The applications the list shows now; `null` when it shows every one. */
  applicationIds: string[] | null;
  disabled: boolean;
}) {
  return (
    <ExportMenu
      name="applications"
      disabled={disabled}
      download={(format) =>
        exportReviewApplications({
          path: { programId },
          query: { format },
          body: { applicationIds },
          parseAs: "blob",
        })
      }
    />
  );
}

export { ExportApplications };
