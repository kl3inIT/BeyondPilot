"use client";

import { FileTextIcon, LinkIcon } from "lucide-react";
import { useState } from "react";

import { PdfViewer } from "@/components/composites/pdf-viewer";
import { cn } from "cn";

type RecordFile =
  | { kind: "file"; label: string; meta: string; href: string }
  | { kind: "link"; label: string; meta: string; href: string }
  /** A link answer that is not a web address: shown, never opened. */
  | { kind: "text"; label: string; meta: string };

/**
 * The files and links of a record. A file, always a PDF, opens in the full-screen viewer, where the
 * reader can step to the record's other files; a link opens in a tab of its own.
 */
function RecordFiles({
  items,
  labels,
  linkClassName,
}: {
  items: RecordFile[];
  labels: { open: string; openLink: string };
  /** The record's link style, so that Open reads like the record's other links. */
  linkClassName: string;
}) {
  const files = items.flatMap((item) =>
    item.kind === "file" ? [{ url: item.href, name: item.label, meta: item.meta }] : [],
  );
  const [shown, setShown] = useState<number | null>(null);

  return (
    <>
      <ul className="flex flex-col divide-y">
        {items.map((item) => (
          <li key={`${item.label}-${item.meta}`} className="flex items-center gap-3 py-2.5 text-sm">
            {item.kind === "file" ? (
              <FileTextIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <LinkIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="flex min-w-0 flex-1 flex-col">
              <span title={item.label} className="truncate font-medium">
                {item.label}
              </span>
              <span title={item.meta} className="truncate text-muted-foreground">
                {item.meta}
              </span>
            </span>
            {item.kind === "file" && (
              <button
                type="button"
                onClick={() => setShown(files.findIndex((file) => file.url === item.href))}
                className={cn("hit-area shrink-0 cursor-pointer", linkClassName)}
              >
                {labels.open}
              </button>
            )}
            {item.kind === "link" && (
              <a
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={cn("hit-area shrink-0", linkClassName)}
              >
                {labels.openLink}
              </a>
            )}
          </li>
        ))}
      </ul>
      <PdfViewer files={files} index={shown} onIndexChange={setShown} />
    </>
  );
}

export { RecordFiles, type RecordFile };
