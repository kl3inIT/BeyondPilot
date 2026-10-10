import {
  ArrowLeftRightIcon,
  BoxIcon,
  BriefcaseBusinessIcon,
  Building2Icon,
  CalendarRangeIcon,
  CornerDownLeftIcon,
  GlobeIcon,
  InfoIcon,
  SearchIcon,
  ShieldCheckIcon,
  TriangleAlertIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { siteRoutes } from "@/lib/site";
import { BrandMark } from "@/components/layout/brand-mark";
import { Badge } from "@/components/ui/badge";
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
 * back. The page says where the app's document lives and where the answer goes, labels a host
 * BeyondPilot has not reviewed, and warns when the answer goes to this computer, where any program
 * could be listening.
 */
function AppConsent({ app, account, scopes, state }: AppConsentProps) {
  const t = useTranslations("AppConsent");
  const forOperators = scopes.includes(OPERATOR_SCOPE);
  const name = app.anyLocalApp ? t("anyLocalApp") : app.name;
  const person = account.displayName ? `${account.displayName} (${account.email})` : account.email;

  if (forOperators && account.role !== "operator") {
    return (
      <Frame app={app}>
        <Head title={t("refusedTitle", { app: name })}>
          <p>{t("refusedLead")}</p>
          <p>{t("signedInAs", { person })}</p>
        </Head>
        <p className="flex w-full gap-2.5 rounded-lg bg-muted p-3 text-sm">
          <InfoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          {t("useUserServer")}
        </p>
        <Answer clientId={app.clientId} state={state} scopes={[]} className="w-full">
          {t("back", { app: app.anyLocalApp ? t("theApp") : app.name })}
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
      <Head title={t("title", { app: name })}>
        <p>{t("as", { person })}</p>
      </Head>
      {app.local && (
        <p className="flex w-full gap-2.5 rounded-lg bg-muted p-3 text-sm">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          {t("localWarning")}
        </p>
      )}
      <section className="flex w-full flex-col gap-3 rounded-xl border bg-background p-4">
        <dl className="flex flex-col gap-3 text-sm">
          {app.host && (
            <Fact icon={GlobeIcon} label={t("from")}>
              {app.host}
              {!app.reviewed && <Badge variant="outline">{t("notReviewed")}</Badge>}
            </Fact>
          )}
          <Fact icon={CornerDownLeftIcon} label={t("returnsTo")}>
            {app.local ? t("thisComputer") : app.returnsTo}
          </Fact>
        </dl>
        <h2 className="border-t pt-3 text-sm font-medium">
          {app.anyLocalApp ? t("ableToLocal") : t("ableTo", { app: app.name })}
        </h2>
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

/** One fact about the app: an icon, a muted label and the value in full weight. */
function Fact({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-2 font-medium">{children}</dd>
    </div>
  );
}

/** The frame of the consent screen; without an app it shows BeyondPilot alone. */
function Frame({ app, children }: { app?: ConnectingApp; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-110 flex-col items-center gap-6 px-5 pt-12 pb-16 md:px-0 md:pt-18 md:pb-30">
      <div className="flex items-center gap-3" aria-hidden="true">
        {app && (
          <>
            <AppMark host={app.host} clientId={app.clientId} />
            <span className="flex items-center gap-1 text-muted-foreground">
              <Dots />
              <ArrowLeftRightIcon className="size-4" />
              <Dots />
            </span>
          </>
        )}
        <span className="flex size-12 items-center justify-center rounded-md border bg-background">
          <BrandMark size={26} className="size-6.5" />
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * What the consent address shows when its request cannot go on: it has expired, was already
 * answered, or names no app. The request lives in the app, so the way on is to connect again there.
 */
function AppConsentExpired() {
  const t = useTranslations("AppConsent.expired");
  return (
    <Frame>
      <Head title={t("title")}>
        <p>{t("lead")}</p>
        <p>{t("next")}</p>
      </Head>
      <Button href={siteRoutes.home} prominence="secondary" size="lg" className="w-full">
        {t("home")}
      </Button>
    </Frame>
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

export { AppConsent, AppConsentExpired };
