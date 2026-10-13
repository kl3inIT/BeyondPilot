import { WorkspaceFrame } from "@/components/layout/workspace-frame";

/** Messages fills the screen under the site's header: its lists and its conversation scroll, the page does not. */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame fill>{children}</WorkspaceFrame>;
}
