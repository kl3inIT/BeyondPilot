"use client";

import { ChevronDownIcon, DownloadIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";

type SpreadsheetFormat = "xlsx" | "csv";

type ExportMenuProps = {
  /**
   * Asks the backend for the list in the format chosen, as the generated client answers with
   * `parseAs: "blob"`. The backend names the file and records the download.
   */
  download: (format: SpreadsheetFormat) => Promise<{ data?: unknown; response: Response }>;
  /** The start of the name to save under when the response gives none, such as `organizations`. */
  name: string;
  disabled?: boolean;
};

/**
 * The page's Export action (docs/conventions.md › Lists): one button that opens Excel and CSV, and
 * saves the file the backend wrote for the list as the screen narrows it. The workbook is the one to
 * read; CSV is for another tool.
 */
function ExportMenu({ download, name, disabled = false }: ExportMenuProps) {
  const t = useTranslations("ExportMenu");
  const notify = useNotify();
  const [pending, setPending] = useState(false);

  async function save(format: SpreadsheetFormat) {
    setPending(true);
    try {
      // The bytes are kept as they came: read as text, the mark that tells Excel a CSV is UTF-8 is lost.
      const { data, response } = await download(format);
      const url = URL.createObjectURL(data as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(response.headers.get("content-disposition")) ?? `${name}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify.failure(error, { otherwise: "ExportMenu.failed" });
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        render={<Button prominence="secondary" pending={pending} disabled={disabled} />}
      >
        {!pending && <DownloadIcon aria-hidden="true" />}
        {t("label")}
        <ChevronDownIcon aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => void save("xlsx")}>
            <FileSpreadsheetIcon aria-hidden="true" />
            {t("xlsx")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void save("csv")}>
            <FileTextIcon aria-hidden="true" />
            {t("csv")}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The name a `Content-Disposition` header gives: `filename*` (RFC 6266, UTF-8) before `filename`.
 */
function fileName(disposition: string | null): string | undefined {
  if (disposition === null) {
    return undefined;
  }
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim());
    } catch {
      // A malformed name falls back to the plain one.
    }
  }
  const plain = /filename="([^"]+)"/i.exec(disposition) ?? /filename=([^;]+)/i.exec(disposition);
  return plain?.[1].trim();
}

export { ExportMenu };
