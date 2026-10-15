"use client";

import { ExternalLinkIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { CopyButton } from "@/components/actions/copy-button";
import { TextButton } from "@/components/actions/text-button";
import { HelpPopover } from "@/components/composites/help-popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppMark } from "@/features/identity/app-mark";

type AppName = "chatgpt" | "claude" | "codex" | "other";

/** One step: its sentence, and the command it asks to run, shown on its own line to copy. */
type Step = { key: `apps.${AppName}.step${1 | 2 | 3}`; command?: (address: string) => string };

/**
 * The apps the pages explain: the host their marks are known by, the steps to connect, and the app's
 * own guide to MCP where it publishes one. Commands are typed as they stand, so they are not words
 * to translate.
 */
const apps: Record<AppName, { host: string | null; steps: readonly Step[]; guide?: string }> = {
  chatgpt: {
    host: "chatgpt.com",
    steps: [
      { key: "apps.chatgpt.step1" },
      { key: "apps.chatgpt.step2" },
      { key: "apps.chatgpt.step3" },
    ],
  },
  claude: {
    host: "claude.ai",
    steps: [
      { key: "apps.claude.step1" },
      { key: "apps.claude.step2" },
      { key: "apps.claude.step3" },
    ],
    guide: "https://claude.com/docs/connectors/custom/add-unlisted",
  },
  codex: {
    host: "chatgpt.com",
    steps: [
      {
        key: "apps.codex.step1",
        command: (address) => `codex mcp add beyondpilot --url ${address}`,
      },
      { key: "apps.codex.step2", command: () => "codex mcp login beyondpilot" },
      { key: "apps.codex.step3" },
    ],
    guide: "https://learn.chatgpt.com/docs/extend/mcp?surface=cli",
  },
  other: { host: null, steps: [{ key: "apps.other.step1" }, { key: "apps.other.step3" }] },
};

type AppKey = keyof typeof apps;

/**
 * What a step's sentence marks: `ui` is a label quoted from the other app's own screen, in that
 * app's language, and `cmd` is something to type or paste as it stands.
 */
function stepParts(address: string) {
  return {
    address,
    ui: (chunks: React.ReactNode) => <span className="font-medium">{chunks}</span>,
    cmd: (chunks: React.ReactNode) => <code className="font-mono text-xs break-all">{chunks}</code>,
  };
}

/** A command to run as it stands, on its own line in the type of a terminal, with a button that copies it. */
function Command({ command }: { command: string }) {
  const t = useTranslations("Mcp.connect");

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background py-1 pr-1 pl-3">
      <code className="min-w-0 flex-1 font-mono text-xs wrap-break-word">{command}</code>
      <CopyButton appearance="icon" value={command} label={t("copyCommand")} />
    </div>
  );
}

/**
 * A server's address, read-only, with a button that copies it. The field grows by a line where the
 * address is wider than the screen, so the whole of it is read and selected on a phone.
 */
function AddressField({ address, label }: { address: string; label: string }) {
  const t = useTranslations("Mcp.connect");
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex items-start gap-2">
        <Textarea id={id} value={address} readOnly rows={1} className="min-h-10 min-w-0 flex-1" />
        <CopyButton value={address} label={t("copy")} />
      </div>
    </div>
  );
}

/**
 * How to connect each app to the server at {@code address}, one tab an app, and a prompt that has an
 * agent set itself up.
 */
function AppSteps({ address, keys }: { address: string; keys: readonly AppKey[] }) {
  const t = useTranslations("Mcp.connect");
  const prompt = t("prompt", { address });

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue={keys[0]}>
        <TabsList variant="underline" aria-label={t("appsLabel")}>
          {keys.map((key) => (
            <TabsTrigger key={key} value={key}>
              <AppMark host={apps[key].host} clientId="mcp-local" inline />
              {t(`apps.${key}.name`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {keys.map((key) => (
          <TabsContent key={key} value={key}>
            <ol className="mt-4 flex flex-col gap-3">
              {apps[key].steps.map((step, index) => (
                <li key={step.key} className="flex items-start gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
                    <span className="break-words">{t.rich(step.key, stepParts(address))}</span>
                    {step.command && <Command command={step.command(address)} />}
                  </div>
                </li>
              ))}
            </ol>
            {apps[key].guide && (
              <TextButton
                href={apps[key].guide}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4"
              >
                {t("guide", { app: t(`apps.${key}.name`) })}
                <ExternalLinkIcon aria-hidden="true" />
              </TextButton>
            )}
            {/* Not a step: what only the person whose app names no client needs to know. */}
            {key === "other" && (
              <p className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
                {t("apps.other.clientHelp")}
                <HelpPopover label={t("apps.other.clientHelp")}>
                  <p>{t("apps.other.step2")}</p>
                </HelpPopover>
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <section className="flex flex-col gap-3 rounded-xl border bg-background p-4">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <SparklesIcon aria-hidden="true" className="size-4 text-primary" />
          {t("askTitle")}
        </h2>
        <div className="flex items-start gap-3 rounded-lg bg-muted p-3">
          <p className="flex-1 text-xs break-words">{prompt}</p>
          <CopyButton appearance="icon" value={prompt} label={t("copyPrompt")} />
        </div>
        <p className="text-xs text-muted-foreground">{t("askNote")}</p>
      </section>
    </div>
  );
}

/**
 * How a person connects an app: the server's address, the steps in ChatGPT, Claude and Codex, a
 * prompt that has an agent set itself up, and questions to try once connected.
 */
function ConnectPanel({ address }: { address: string }) {
  const t = useTranslations("Mcp.connect");

  return (
    <div className="flex flex-col gap-8">
      <AddressField address={address} label={t("address")} />
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AppSteps address={address} keys={["chatgpt", "claude", "codex"]} />
        </div>
        <section className="flex flex-col gap-3 lg:col-span-2">
          <h2 className="text-lg font-medium">{t("tryTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {(["claims", "programs", "compare"] as const).map((key) => (
              <li key={key} className="flex gap-2.5 rounded-xl border bg-background p-3 text-sm">
                <MessageSquareIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-primary"
                />
                {t(`try.${key}`)}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

export { AddressField, AppSteps, ConnectPanel };
