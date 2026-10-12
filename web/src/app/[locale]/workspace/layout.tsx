import { MessageScope } from "@/i18n/message-scope";

/** The signed-in workspaces of organizations and talent: they send the browser their own messages. */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <MessageScope area="workspace">{children}</MessageScope>;
}
