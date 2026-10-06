import { ArrowLeftIcon, BanIcon, CircleAlertIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import type { EmailMessage } from "@/lib/api/generated";
import { adminEmailTemplateRoute, siteRoutes } from "@/lib/site";

import { isEmailKind, KindIcon } from "./email-kinds";
import { EmailMessageActions } from "./email-message-actions";
import { EmailPreview } from "./email-preview";
import { EmailStatusLabel } from "./email-status";

/** Why an email did not leave, as the backend records it. */
const failures = [
  "not_configured",
  "authentication",
  "throttled",
  "unavailable",
  "rejected",
  "invalid_recipient",
  "suppressed",
  "expired",
] as const;

function isFailure(reason: string): reason is (typeof failures)[number] {
  return (failures as readonly string[]).includes(reason);
}

/**
 * One email as it was sent: to whom, through which provider, what happened to it since, and its
 * content as the mailbox showed it. An email that never reached its reader can be sent again.
 */
async function EmailMessagePage({ message }: { message: EmailMessage }) {
  const [t, format] = await Promise.all([getTranslations("Admin.email"), getFormatter()]);
  const when = (at: string) =>
    format.dateTime(new Date(at), { dateStyle: "medium", timeStyle: "medium" });
  const kindName = isEmailKind(message.kind) ? t(`kinds.${message.kind}.name`) : message.kind;

  const facts = [
    { key: "recipient", value: message.recipient },
    {
      key: "kind",
      value: isEmailKind(message.kind) ? (
        <Link
          href={adminEmailTemplateRoute(message.kind)}
          className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-4 hover:underline"
        >
          <KindIcon kind={message.kind} className="size-4 shrink-0" />
          {kindName}
        </Link>
      ) : (
        kindName
      ),
    },
    { key: "created", value: <time dateTime={message.createdAt}>{when(message.createdAt)}</time> },
    {
      key: "sent",
      value: message.sentAt ? <time dateTime={message.sentAt}>{when(message.sentAt)}</time> : "—",
    },
    { key: "provider", value: message.provider ? t(`providers.${message.provider}.name`) : "—" },
    {
      key: "providerId",
      value: message.providerMessageId ? (
        <span className="font-mono text-xs break-all">{message.providerMessageId}</span>
      ) : (
        "—"
      ),
    },
    { key: "attempts", value: format.number(message.attempts) },
  ] as const;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <Link
        href={siteRoutes.adminEmailActivity}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        {t("message.back")}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{message.subject}</h1>
            <EmailStatusLabel status={message.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {t("message.lead", { kind: kindName, recipient: message.recipient })}
          </p>
        </div>
        <EmailMessageActions message={message} />
      </div>

      {message.suppression && (
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
          <BanIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("message.suppressed.title")}</p>
            <p className="text-sm text-muted-foreground">
              {t(`message.suppressed.${message.suppression.reason}`)}{" "}
              <Link
                href={`${siteRoutes.adminEmailSuppressions}?q=${encodeURIComponent(message.recipient)}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t("message.suppressed.manage")}
              </Link>
            </p>
          </div>
        </div>
      )}

      {message.lastError && (
        <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
          <CircleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-medium">{t("message.lastError")}</p>
            <p className="text-sm text-muted-foreground">
              {isFailure(message.lastError)
                ? t(`message.failures.${message.lastError}`)
                : t("message.failures.unavailable")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-6 lg:w-96 lg:shrink-0">
          <section className="flex flex-col gap-3" aria-labelledby="message-facts">
            <h2 id="message-facts" className="text-base font-medium">
              {t("message.facts")}
            </h2>
            <dl className="flex flex-col divide-y rounded-lg border">
              {facts.map((fact) => (
                <div key={fact.key} className="flex flex-col gap-0.5 px-4 py-2.5">
                  <dt className="text-xs text-muted-foreground">{t(`message.fields.${fact.key}`)}</dt>
                  <dd className="min-w-0 text-sm break-words">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="message-events">
            <h2 id="message-events" className="text-base font-medium">
              {t("message.events.title")}
            </h2>
            {message.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(message.provider === "smtp" ? "message.events.smtp" : "message.events.none")}
              </p>
            ) : (
              <ol className="flex flex-col gap-3 border-l pl-4">
                {message.events.map((event) => (
                  <li key={`${event.type}-${event.occurredAt}`} className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium">{t(`message.events.types.${event.type}`)}</p>
                    <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">
                      {when(event.occurredAt)}
                    </time>
                    {event.detail && (
                      <p className="font-mono text-xs break-words text-muted-foreground">
                        {event.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <EmailPreview
          subject={message.subject}
          html={message.html}
          title={t("message.previewTitle", { subject: message.subject })}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  );
}

export { EmailMessagePage };
