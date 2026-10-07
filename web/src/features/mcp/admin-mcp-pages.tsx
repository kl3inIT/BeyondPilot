import { getTranslations } from "next-intl/server";

import { AdminPageTitle } from "@/components/layout/admin-icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
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

type McpTab = "setup" | "tools";

/** The head of Admin › AI › MCP: its title and its tabs. */
async function McpAdminHeader({ current, tools }: { current: McpTab; tools: number }) {
  const t = await getTranslations("Admin.mcp");
  const tabs = [
    { key: "setup", href: siteRoutes.adminMcp },
    { key: "tools", href: siteRoutes.adminMcpTools },
  ] as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <AdminPageTitle destination="mcp">{t("title")}</AdminPageTitle>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <nav aria-label={t("tabs.label")} className="border-b">
        <ul className="flex gap-4 overflow-x-auto md:gap-6">
          {tabs.map((tab) => (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={tab.key === current ? "page" : undefined}
                className={
                  tab.key === current
                    ? "inline-flex min-h-11 items-center gap-1.5 border-b-2 border-foreground text-sm font-medium whitespace-nowrap outline-none focus-visible:underline"
                    : "inline-flex min-h-11 items-center gap-1.5 border-b-2 border-transparent text-sm whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
                }
              >
                {t(`tabs.${tab.key}`)}
                {tab.key === "tools" && <span className="text-xs font-medium">{tools}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
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
  lead: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={`grid gap-4 md:grid-cols-3 md:gap-12 ${first ? "" : "border-t pt-8"}`}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{lead}</p>
      </div>
      <div className="flex flex-col gap-5 md:col-span-2">{children}</div>
    </section>
  );
}

/**
 * Admin › AI › MCP › Setup: how an operator connects their app to the operators' server, the user
 * server's switch and address, and which apps may connect.
 */
async function McpSetupPage({ settings, hosts }: { settings: McpSettings; hosts: AppHosts }) {
  const t = await getTranslations("Admin.mcp.setup");

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <McpAdminHeader current="setup" tools={settings.tools.length} />
      <SettingsSection title={t("operator.title")} lead={t("operator.lead")} first>
        <AddressField address={settings.operatorServerAddress} label={t("address")} />
        <AppSteps
          address={settings.operatorServerAddress}
          keys={["codex", "claude", "chatgpt", "other"]}
        />
      </SettingsSection>
      <SettingsSection title={t("user.title")} lead={t("user.lead")}>
        <UserServerSwitch enabled={settings.userServerEnabled} />
        <AddressField address={settings.userServerAddress} label={t("address")} />
      </SettingsSection>
      <SettingsSection title={t("hosts.title")} lead={t("hosts.lead")}>
        <OtherHostsSwitch allowed={hosts.allowOtherHosts} />
        <ul className="overflow-hidden rounded-lg border bg-background">
          {hosts.hosts.map((host) => (
            <li
              key={host.host}
              className="flex items-center gap-3 border-b px-3.5 py-2 last:border-b-0"
            >
              <div className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-2">
                <span className="text-sm font-medium">{host.host}</span>
                {host.apps.length > 0 && (
                  <span className="truncate text-xs text-muted-foreground md:text-sm">
                    {host.apps.join(", ")}
                  </span>
                )}
              </div>
              <RemoveHost host={host.host} />
            </li>
          ))}
        </ul>
        <AddHost />
      </SettingsSection>
    </div>
  );
}

/** Admin › AI › MCP › Tools: every tool of both servers, each with its switch. */
async function McpToolsPage({ settings }: { settings: McpSettings }) {
  const t = await getTranslations("Admin.mcp.tools");
  const servers = ["operator", "user"] as const;

  return (
    <div className="flex flex-1 flex-col gap-8 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <McpAdminHeader current="tools" tools={settings.tools.length} />
      {servers.map((server, index) => (
        <SettingsSection
          key={server}
          title={t(`${server}.title`)}
          lead={t(`${server}.lead`)}
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
                      <Badge variant="outline">{t("reads")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {tool.name === "search"
                        ? t(`${server}.search`)
                        : tool.name === "fetch"
                          ? t(`${server}.fetch`)
                          : tool.description}
                    </p>
                  </div>
                  <ToolSwitch
                    server={tool.server}
                    name={tool.name}
                    enabled={tool.enabled}
                    label={t("switch", { tool: tool.name })}
                  />
                </li>
              ))}
          </ul>
        </SettingsSection>
      ))}
    </div>
  );
}

export { McpSetupPage, McpToolsPage };
