"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// A page of the admin area that fails is replaced inside the frame, so the sidebar stays.
export default function AdminErrorPage(props: ErrorNoticeProps) {
  return <ErrorNotice {...props} />;
}
