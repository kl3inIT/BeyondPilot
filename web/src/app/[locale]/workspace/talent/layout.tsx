import { WorkspaceFrame } from "@/components/layout/workspace-frame";

/** These pages stand inside the site's header and footer. */
export default function WorkspaceSectionLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceFrame>{children}</WorkspaceFrame>;
}
