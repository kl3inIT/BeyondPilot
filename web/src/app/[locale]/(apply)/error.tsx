"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// The application form has no navigation to keep; a failure stands alone where the skip link lands.
export default function ApplyErrorPage(props: ErrorNoticeProps) {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorNotice {...props} />
    </main>
  );
}
