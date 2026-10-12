"use client";

import { ErrorNotice, type ErrorNoticeProps } from "@/components/layout/error-notice";

// The failure of a page that draws the site's frame itself, or has none: the frame reads the session
// on the server, so it cannot be drawn here, and the notice stands alone as the page's main content.
// A section whose layout draws the frame has an error page of its own, which keeps it.
export default function WorkspaceErrorPage(props: ErrorNoticeProps) {
  return (
    <main className="flex flex-1 flex-col">
      <ErrorNotice {...props} />
    </main>
  );
}
