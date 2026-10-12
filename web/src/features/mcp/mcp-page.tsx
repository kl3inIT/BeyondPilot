import { getTranslations } from "next-intl/server";

import type { ConnectedApp } from "@/lib/api/generated";

import { ConnectPanel } from "./connect-panel";
import { McpTabs } from "./connected-apps";

/**
 * A person's MCP page: what connecting an AI app to BeyondPilot's MCP server gives and what the app
 * may do, how to connect one, and the apps they connected, each with Revoke.
 */
async function McpPage({ address, apps }: { address: string; apps: ConnectedApp[] }) {
  const t = await getTranslations("Mcp");

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24 lg:px-16">
      <div className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-3xl leading-none font-semibold tracking-title md:text-5xl md:leading-none">
            {t("title")}
          </h1>
          {/* What connecting gives, then what the app may do and how it ends: read before the address. */}
          <p className="max-w-prose text-base">{t("lead")}</p>
          <p className="max-w-prose text-sm text-muted-foreground">{t("limits")}</p>
        </div>
        <McpTabs connect={<ConnectPanel address={address} />} apps={apps} />
      </div>
    </div>
  );
}

export { McpPage };
