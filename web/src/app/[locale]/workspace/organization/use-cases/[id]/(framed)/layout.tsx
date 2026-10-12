import { WorkspaceFrame } from "@/components/layout/workspace-frame";

/**
 * The pages of one use case that stand inside the site's header and footer: its candidates, the
 * proposals it received, one of them, and the page after sending. The frame is drawn here and not
 * by each page, so a page that fails keeps it. The editor beside this group is a screen of its own.
 */
export default function UseCaseFramedLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
