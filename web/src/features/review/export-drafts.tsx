"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { exportProgramDrafts } from "@/lib/api/generated";

/**
 * Downloads a program's drafts not submitted yet as a spreadsheet, with their applicants' contact
 * details and how far they got, to write to them outside BeyondPilot. The backend records each
 * download.
 */
function ExportDrafts({
  programId,
  slug,
  disabled,
}: {
  programId: string;
  /** The program's address, which names the file. */
  slug: string;
  disabled: boolean;
}) {
  const t = useTranslations("Review.drafts");
  const notify = useNotify();
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      // The bytes are kept as they came: read as text, the mark that tells Excel the file is UTF-8 is lost.
      const { data } = await exportProgramDrafts({ path: { programId }, parseAs: "blob" });
      const url = URL.createObjectURL(data as unknown as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}-drafts.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      notify.error("Review.list.downloadFailed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button prominence="secondary" pending={pending} disabled={disabled} onClick={download}>
      {!pending && <DownloadIcon aria-hidden="true" />}
      {t("download")}
    </Button>
  );
}

export { ExportDrafts };
