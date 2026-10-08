"use client";

import { CheckIcon, CopyIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { Input } from "@/components/ui/input";
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
  other: { host: null, steps: ["apps.other.step1", "apps.other.step2", "apps.other.step3"] },
} as const;

type AppKey = keyof typeof apps;

/** Copies a text, and says so for a moment. */
function useCopy() {
  const [copied, setCopied] = useState(false);
  return {
    copied,
    copy(text: string) {
      void navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    },
  };
}

/** A server's address, read-only, with a button that copies it. */
function AddressField({ address, label }: { address: string; label: string }) {
  const t = useTranslations("Mcp.connect");
  const id = useId();
  const copy = useCopy();

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <Input id={id} value={address} readOnly className="flex-1" />
        <Button prominence="secondary" onClick={() => copy.copy(address)}>
          {copy.copied ? t("copied") : t("copy")}
        </Button>
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
  const promptCopy = useCopy();
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
                  <span className="pt-0.5 break-words">{t(step, { address })}</span>
                </li>
              ))}
            </ol>
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
          <IconButton
            size="sm"
            prominence="tertiary"
            aria-label={promptCopy.copied ? t("copied") : t("copyPrompt")}
            onClick={() => promptCopy.copy(prompt)}
          >
            {promptCopy.copied ? <CheckIcon /> : <CopyIcon />}
          </IconButton>
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
