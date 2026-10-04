"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

export default function ErrorPage(props: ErrorNoticeProps) {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorNotice {...props} />
    </main>
  );
}
