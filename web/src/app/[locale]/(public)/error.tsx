"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// A public page that fails is replaced inside the frame, so the site's header and footer stay.
export default function PublicErrorPage(props: ErrorNoticeProps) {
  return <ErrorNotice {...props} />;
}
