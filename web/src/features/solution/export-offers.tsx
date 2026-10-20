"use client";

import { ExportMenu } from "@/components/composites/export-menu";
import { exportAdminOffers } from "@/lib/api/generated";

/**
 * Downloads the offers the list shows, in its order. The list is narrowed here rather than by the
 * backend, so the download names the offers, and the filters only to say in the file how it was
 * narrowed. The backend records each download.
 */
function ExportOffers({ ids, state, q }: { ids: string[]; state: string | null; q: string }) {
  return (
    <ExportMenu
      name="offers"
      disabled={ids.length === 0}
      download={(format) =>
        exportAdminOffers({
          query: { format },
          body: { ids, state, q: q.trim() || null },
          parseAs: "blob",
        })
      }
    />
  );
}

export { ExportOffers };
