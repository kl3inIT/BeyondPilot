import {
  ArrowLeftRightIcon,
  BoxIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarRangeIcon,
  InfoIcon,
  SearchIcon,
  ShieldCheckIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { BrandMark } from "@/components/layout/brand-mark";
import { AppMark } from "@/features/identity/app-mark";
import { SwitchAccount } from "@/features/identity/switch-account";
import type { ConnectingApp, Me } from "@/lib/api/generated";

/** The scope of the operators' server; the other scopes read what BeyondPilot publishes. */
const OPERATOR_SCOPE = "mcp.research";

/** Where Spring's authorization server takes the answer, as a full navigation so the app gets it. */
const AUTHORIZE = "/oauth2/authorize";

type AppConsentProps = {
  app: ConnectingApp;
  account: Me;
  /** The scopes the app asked for, as the authorization server listed them. */
  scopes: string[];
  state: string;
};

/**
 * Asks the signed-in person to let an AI app use BeyondPilot's MCP server as them. Allow grants
 * every scope the app asked for; Deny grants none, which tells the app access was denied. Someone
 * who is not an operator cannot connect an app to the operators' server, so they only get the way
 * back.
 */
function AppConsent({ app, account, scopes, state }: AppConsentProps) {
  const t = useTranslations("AppConsent");
  const forOperators = scopes.includes(OPERATOR_SCOPE);
  const person = account.displayName ? `${account.displayName} (${account.email})` : account.email;

  if (forOperators && account.role !== "operator") {
    return (
      <Frame app={app}>
        <Head title={t("refusedTitle", { app: app.name })}>
          <p>{t("refusedLead")}</p>
          <p>{t("signedInAs", { person })}</p>
        </Head>
        <p className="flex w-full gap-2.5 rounded-lg bg-muted p-3 text-sm">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {t("useUserServer")}
        </p>
        <Answer clientId={app.clientId} state={state} scopes={[]} className="w-full">
          {t("back", { app: app.name })}
        </Answer>
        <SwitchAccount label={t("anotherAccount")} />
      </Frame>
    );
  }

  const abilities: { icon: LucideIcon; text: string }[] = forOperators
    ? [
        { icon: SearchIcon, text: t("operator.searchSolutions") },
        { icon: BriefcaseBusinessIcon, text: t("operator.readUseCases") },
        { icon: Building2Icon, text: t("operator.findCompanies") },
      ]
    : [
        { icon: SearchIcon, text: t("user.searchSolutions") },
        { icon: BoxIcon, text: t("user.readSolution") },
        { icon: CalendarRangeIcon, text: t("user.searchPrograms") },
      ];

  return (
    <Frame app={app}>
      <Head title={t("title", { app: app.name })}>
        <p>{t("as", { person })}</p>
      </Head>
      <section className="flex w-full flex-col gap-3 rounded-xl border bg-background p-4">
        <h2 className="text-sm font-medium">{t("ableTo", { app: app.name })}</h2>
        <ul className="flex flex-col gap-3">
          {abilities.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-2.5 text-sm">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
              {text}
            </li>
          ))}
        </ul>
        <p className="flex gap-2.5 border-t pt-3 text-sm text-muted-foreground">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          {forOperators ? t("operator.limit") : t("user.limit")}
        </p>
      </section>
      <div className="flex w-full gap-2">
        <Answer clientId={app.clientId} state={state} scopes={[]} className="flex-1">
          {t("deny")}
        </Answer>
        <Answer clientId={app.clientId} state={state} scopes={scopes} className="flex-1">
          {t("allow")}
        </Answer>
      </div>
      <SwitchAccount label={t("switchAccount")} />
    </Frame>
  );
}

function Frame({ app, children }: { app: ConnectingApp; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-110 flex-col items-center gap-6 px-5 pt-12 pb-16 md:px-0 md:pt-18 md:pb-30">
      <div className="flex items-center gap-3" aria-hidden="true">
        <AppMark host={app.host} clientId={app.clientId} />
        <span className="flex items-center gap-1 text-muted-foreground">
          <Dots />
          <ArrowLeftRightIcon className="size-4" />
          <Dots />
        </span>
        <span className="flex size-12 items-center justify-center rounded-md border bg-background">
          <BrandMark size={26} className="size-6.5" />
        </span>
      </div>
      {children}
    </div>
  );
}

function Dots() {
  return (
    <span className="flex gap-1">
      {[0, 1, 2].map((dot) => (
        <span key={dot} className="size-1 rounded-full bg-border" />
      ))}
    </span>
  );
}

function Head({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-semibold text-balance">{title}</h1>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

type AnswerProps = {
  clientId: string;
  state: string;
  /** The scopes granted; none denies. */
  scopes: string[];
  className?: string;
  children: React.ReactNode;
};

/** A plain form to the authorization server, which answers with a redirect back to the app. */
function Answer({ clientId, state, scopes, className, children }: AnswerProps) {
  return (
    <form action={AUTHORIZE} method="post" className={className}>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="state" value={state} />
      {scopes.map((scope) => (
        <input key={scope} type="hidden" name="scope" value={scope} />
      ))}
      <Button
        type="submit"
        size="lg"
        prominence={scopes.length > 0 ? "primary" : "secondary"}
        className="w-full"
      >
        {children}
      </Button>
    </form>
  );
}

export { AppConsent };
