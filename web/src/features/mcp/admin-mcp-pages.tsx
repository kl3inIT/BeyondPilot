import { getTranslations } from "next-intl/server";

import { PageTabs } from "@/components/composites/page-tabs";
import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { Badge } from "@/components/ui/badge";
import type { AppHosts, McpSettings } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import {
  AddHost,
  OtherHostsSwitch,
  RemoveHost,
  ToolSwitch,
  UserServerSwitch,
} from "./admin-mcp-actions";
import { AddressField, AppSteps } from "./connect-panel";

/** The operators' server's own tools, each described in the messages. */
const OPERATOR_TOOLS = [
  "list_applications",
  "get_application",
  "read_application_file",
  "list_pending_reviews",
  "list_records",
  "get_record",
  "list_proposals",
  "get_proposal",
  "list_programs",
  "get_program",
  "list_accounts",
  "list_audit_events",
  "list_emails",
  "get_email",
  "list_matching_runs",
  "get_matching_run",
  "get_matches",
] as const;

function isOperatorTool(name: string): name is (typeof OPERATOR_TOOLS)[number] {
  return (OPERATOR_TOOLS as readonly string[]).includes(name);
}

type McpTab = "setup" | "tools" | "apps" | "activity";

/**
 * How many tools the servers have and how many apps are connected, which the tabs show, and how
 * many of those apps use each server, which a question before switching one off says.
 */
type McpCounts = { tools: number; apps: number; operatorApps: number; userApps: number };

/** The head of Admin › AI › MCP: its title and its tabs. */
async function McpAdminHeader({
  current,
  counts,
  action,
}: {
  current: McpTab;
  counts: McpCounts;
  /** The screen's own button, beside the title. */
  action?: React.ReactNode;
}) {
  const t = await getTranslations("Admin.mcp");
  const tabs = [
    { key: "setup", href: siteRoutes.adminMcp, count: null },
    { key: "tools", href: siteRoutes.adminMcpTools, count: counts.tools },
    { key: "apps", href: siteRoutes.adminMcpApps, count: counts.apps },
    { key: "activity", href: siteRoutes.adminMcpActivity, count: null },
  ] as const;

  return (
    <AdminPageHeader destination="mcp" title={t("title")} actions={action}>
      <PageTabs
        label={t("tabs.label")}
        current={current}
        tabs={tabs.map((tab) => ({
          key: tab.key,
          href: tab.href,
          label: t(`tabs.${tab.key}`),
          // A count shows only when there is something to count.
          count: tab.count !== null && tab.count > 0 ? tab.count : undefined,
        }))}
      />
    </AdminPageHeader>
  );
}

/** A titled section of a settings page: what it is about on the left, its fields on the right. */
function SettingsSection({
  title,
  lead,
  first = false,
  children,
}: {
  title: string;
  lead?: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-12 ${first ? "" : "border-t pt-8"}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{title}</h2>
        {lead && <p className="text-sm text-muted-foreground">{lead}</p>}
      </div>
      <div className="flex min-w-0 flex-col gap-5 md:col-span-2">{children}</div>
    </section>
  );
}

/**
 * Admin › AI › MCP › Setup: how an operator connects their app to the operators' server, the user
 * server's switch and address, and which apps may connect.
 */
async function McpSetupPage({
  settings,
  hosts,
  counts,
}: {
  settings: McpSettings;
  hosts: AppHosts;
  counts: McpCounts;
}) {
  const t = await getTranslations("Admin.mcp.setup");

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <McpAdminHeader current="setup" counts={counts} />
      <SettingsSection title={t("operator.title")} lead={t("operator.lead")} first>
        <AddressField address={settings.operatorServerAddress} label={t("operator.address")} />
        <AppSteps
          address={settings.operatorServerAddress}
          keys={["codex", "claude", "chatgpt", "other"]}
        />
      </SettingsSection>
      <SettingsSection title={t("user.title")} lead={t("user.lead")}>
        <UserServerSwitch enabled={settings.userServerEnabled} apps={counts.userApps} />
        <AddressField address={settings.userServerAddress} label={t("user.address")} />
      </SettingsSection>
      <SettingsSection title={t("hosts.title")} lead={t("hosts.lead")}>
        <OtherHostsSwitch allowed={hosts.allowOtherHosts} />
        <ul className="overflow-hidden rounded-lg border bg-background">
          {hosts.hosts.map((host) => (
            <li
              key={host.host}
              className="flex items-center gap-3 border-b px-3.5 py-2 last:border-b-0"
            >
              {/* Which apps a host stands for decides whether to keep it, so every name shows. */}
              <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-baseline md:gap-2">
                <span className="text-sm font-medium break-all">{host.host}</span>
                {host.apps.length > 0 && (
                  <span className="min-w-0 text-xs break-words text-muted-foreground md:text-sm">
                    {host.apps.join(", ")}
                  </span>
                )}
              </div>
              <RemoveHost host={host.host} apps={host.apps} othersAllowed={hosts.allowOtherHosts} />
            </li>
          ))}
        </ul>
        <AddHost />
      </SettingsSection>
    </div>
  );
}

/** Admin › AI › MCP › Tools: every tool of both servers, each with its switch. */
async function McpToolsPage({ settings, counts }: { settings: McpSettings; counts: McpCounts }) {
  const t = await getTranslations("Admin.mcp.tools");
  const servers = ["operator", "user"] as const;

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <McpAdminHeader current="tools" counts={counts} />
      {servers.map((server, index) => (
        <SettingsSection
          key={server}
          title={t(`${server}.title`)}
          lead={server === "operator" ? t("operator.lead") : undefined}
          first={index === 0}
        >
          <ul className="overflow-hidden rounded-lg border bg-background">
            {settings.tools
              .filter((tool) => tool.server === server)
              .map((tool) => (
                <li
                  key={tool.name}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{tool.name}</span>
                      {tool.readOnly ? (
                        <Badge variant="outline">{t("reads")}</Badge>
                      ) : (
                        <Badge variant="warning">{t("changes")}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tool.name === "search"
                        ? t(`${server}.search`)
                        : tool.name === "fetch"
                          ? t(`${server}.fetch`)
                          : isOperatorTool(tool.name)
                            ? t(`operator.${tool.name}`)
                            : tool.description}
                    </p>
                  </div>
                  <ToolSwitch
                    server={tool.server}
                    serverName={t(`${server}.title`)}
                    name={tool.name}
                    enabled={tool.enabled}
                    label={t("switch", { tool: tool.name })}
                    apps={server === "operator" ? counts.operatorApps : counts.userApps}
                  />
                </li>
              ))}
          </ul>
        </SettingsSection>
      ))}
    </div>
  );
}

export { McpAdminHeader, McpSetupPage, McpToolsPage, type McpCounts };
