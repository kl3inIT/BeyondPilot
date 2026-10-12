"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// A page that fails here is replaced inside the frame its layout draws, so the site's header and footer stay.
export default function UseCaseFramedErrorPage(props: ErrorNoticeProps) {
  return <ErrorNotice {...props} />;
}
