"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// A page of a judge's Reviews that fails is replaced inside the frame, so the sidebar stays.
export default function ReviewsErrorPage(props: ErrorNoticeProps) {
  return <ErrorNotice {...props} />;
}
