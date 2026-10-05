"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// A page of a person's own area that fails is replaced inside the frame, so the header stays.
export default function WorkspaceErrorPage(props: ErrorNoticeProps) {
  return <ErrorNotice {...props} />;
}
