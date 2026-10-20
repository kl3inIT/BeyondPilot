"use client";

import { EyeIcon } from "lucide-react";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { PdfViewer } from "@/components/composites/pdf-viewer";

type PdfOpenButtonProps = {
  /** Where the PDF is read, on this origin or the browser's own copy of it. */
  url: string;
  name: string;
  /** What the file is and how large, as the viewer says it under the name. */
  meta: string;
  /** What the button says: "Open". */
  label: string;
  /** What it is named for assistive technology, the file with it: "Open deck.pdf". */
  accessibleLabel: string;
};

/** An action that opens one PDF in the full-screen viewer, with the download still at hand there. */
function PdfOpenButton({ url, name, meta, label, accessibleLabel }: PdfOpenButtonProps) {
  const [shown, setShown] = useState<number | null>(null);

  return (
    <>
      <TextButton aria-label={accessibleLabel} onClick={() => setShown(0)}>
        <EyeIcon aria-hidden="true" />
        {label}
      </TextButton>
      <PdfViewer files={[{ url, name, meta }]} index={shown} onIndexChange={setShown} />
    </>
  );
}

export { PdfOpenButton };
