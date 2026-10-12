"use client";

import { MessageSquareIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { CopyButton } from "@/components/actions/copy-button";
import { HelpPopover } from "@/components/composites/help-popover";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppMark } from "@/features/identity/app-mark";

/** The apps the pages explain, with the host their marks are known by and the steps to connect. */
const apps = {
  chatgpt: {
    host: "chatgpt.com",
    steps: ["apps.chatgpt.step1", "apps.chatgpt.step2", "apps.chatgpt.step3"],
  },
  claude: {
    host: "claude.ai",
    steps: ["apps.claude.step1", "apps.claude.step2", "apps.claude.step3"],
  },
  codex: { host: "chatgpt.com", steps: ["apps.codex.step1", "apps.codex.step2"] },
  other: { host: null, steps: ["apps.other.step1", "apps.other.step3"] },
} as const;

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
        <Textarea id={id} value={address} readOnly rows={1} className="min-h-10 flex-1" />
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
                <li key={step} className="flex items-start gap-3 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5 break-words">
                    {t.rich(step, stepParts(address))}
                  </span>
                </li>
              ))}
            </ol>
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
