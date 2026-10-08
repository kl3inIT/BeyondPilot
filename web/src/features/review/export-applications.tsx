"use client";

import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { exportReviewApplications } from "@/lib/api/generated";

type ExportApplicationsProps = {
  programId: string;
  /** The program's address, which names the file. */
  slug: string;
  /** The applications the list shows now; `null` when it shows every one. */
  applicationIds: string[] | null;
  disabled: boolean;
};

/**
 * Downloads a program's applications as a spreadsheet: the ones the list shows, with their
 * applicants' contact details. The backend records each download.
 */
function ExportApplications({
  programId,
  slug,
  applicationIds,
  disabled,
}: ExportApplicationsProps) {
  const t = useTranslations("Review.list");
  const notify = useNotify();
  const [pending, setPending] = useState(false);

  async function download() {
    setPending(true);
    try {
      // The bytes are kept as they came: read as text, the mark that tells Excel the file is UTF-8 is lost.
      const { data } = await exportReviewApplications({
        path: { programId },
        body: { applicationIds },
        parseAs: "blob",
      });
      const url = URL.createObjectURL(data as unknown as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}-applications.csv`;
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

export { ExportApplications };
