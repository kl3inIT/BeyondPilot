"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminPrograms } from "@/lib/api/generated";

/**
 * Downloads the programs the list shows, in its order. The list is narrowed here rather than by the
 * backend, so the download names the programs, and the filters only to say in the file how it was
 * narrowed. The backend records each download.
 */
function ExportPrograms({ ids, state, q }: { ids: string[]; state: string | null; q: string }) {
  return (
    <ExportMenu
      name="programs"
      disabled={ids.length === 0}
      download={(format) =>
        exportAdminPrograms({
          query: { format },
          body: { ids, state, q: q.trim() || null },
          parseAs: "blob",
        })
      }
    />
  );
}

export { ExportPrograms };
