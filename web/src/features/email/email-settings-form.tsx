"use client";

import { revalidateLogic, useStore } from "@tanstack/react-form";
import {
  CheckIcon,
  CloudIcon,
  CopyIcon,
  KeyRoundIcon,
  SendIcon,
  ServerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { z } from "zod";

import { LeaveGuard } from "@/components/composites/leave-guard";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  saveEmailSettings,
  testEmailSettings,
  type EmailSettings,
  type SaveEmailSettings,
} from "@/lib/api/generated";

import { testFailures, testRefusals } from "./email-test-failures";
import { TestSend } from "./test-send";

const providers = ["ses", "resend", "smtp"] as const;
const securities = ["starttls", "tls", "none"] as const;

/** Each provider's icon on its card: plain, beside its name. */
const providerIcons = { ses: CloudIcon, resend: SendIcon, smtp: ServerIcon } as const;

type Provider = (typeof providers)[number];

/** The form's values: every field as text, so a field is never uncontrolled. */
type Values = {
  provider: Provider;
  fromName: string;
  fromAddress: string;
  replyTo: string;
  smtp: {
    host: string;
    port: string;
    security: (typeof securities)[number];
    username: string;
    password: string;
  };
  ses: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    configurationSet: string;
    eventsTopicArn: string;
  };
  resend: { apiKey: string; webhookSecret: string };
};

function valuesOf(settings: EmailSettings): Values {
  return {
    provider: settings.provider ?? "resend",
    fromName: settings.fromName ?? "BeyondPilot",
    fromAddress: settings.fromAddress ?? "",
    replyTo: settings.replyTo ?? "",
    smtp: {
      host: settings.smtp.host ?? "",
      port: settings.smtp.port ? String(settings.smtp.port) : "587",
      security: settings.smtp.security,
      username: settings.smtp.username ?? "",
      password: "",
    },
    ses: {
      region: settings.ses.region ?? "",
      accessKeyId: settings.ses.accessKeyId ?? "",
      secretAccessKey: "",
      configurationSet: settings.ses.configurationSet ?? "",
      eventsTopicArn: settings.ses.eventsTopicArn ?? "",
    },
    resend: { apiKey: "", webhookSecret: "" },
  };
}

/** The body the backend takes: empty text is no value, and an empty secret keeps the one stored. */
function bodyOf(values: Values, version: number): SaveEmailSettings {
  const text = (value: string) => value.trim() || null;
  return {
    version,
    provider: values.provider,
    fromName: values.fromName.trim(),
    fromAddress: values.fromAddress.trim(),
    replyTo: text(values.replyTo),
    smtp: {
      host: text(values.smtp.host),
      port: values.smtp.port.trim() ? Number(values.smtp.port) : null,
      security: values.smtp.security,
      username: text(values.smtp.username),
      password: values.smtp.password || null,
    },
    ses: {
      region: text(values.ses.region),
      accessKeyId: text(values.ses.accessKeyId),
      secretAccessKey: values.ses.secretAccessKey || null,
      configurationSet: text(values.ses.configurationSet),
      eventsTopicArn: text(values.ses.eventsTopicArn),
    },
    resend: {
      apiKey: values.resend.apiKey || null,
      webhookSecret: values.resend.webhookSecret || null,
    },
  };
}

/** One part of the settings: its title and what it is for beside its fields. */
function Section({
  title,
  what,
  children,
}: {
  title: string;
  what: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-x-12 gap-y-4 border-t pt-8 first:border-t-0 first:pt-0 lg:flex-row">
      <div className="flex flex-col gap-1 lg:w-72 lg:shrink-0">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-sm text-muted-foreground">{what}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-5 md:max-w-2xl">{children}</div>
    </section>
  );
}

/** An address the provider calls, to copy into its console. */
function CopyField({
  id,
  label,
  value,
  description,
}: {
  id: string;
  label: string;
  value: string;
  description: string;
}) {
  const t = useTranslations("Admin.email.settings");
  const [copied, setCopied] = useState(false);
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput id={id} value={value} readOnly />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={t("copy")}
            onClick={() => {
              void navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}

/**
 * Admin › Email › Settings: who email comes from and which provider delivers it. A secret is
 * written, never read back: a stored one shows as saved, and an empty field keeps it. Send a test
 * tries the settings on the form, saved or not, by sending to the operator's own address.
 */
function EmailSettingsForm({
  settings,
  operatorEmail,
}: {
  settings: EmailSettings;
  operatorEmail: string;
}) {
  const t = useTranslations("Admin.email.settings");
  const names = useTranslations("Admin.email.providers");
  const say = useTranslations("Form.errors");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const [current, setCurrent] = useState(settings);
  const [testing, setTesting] = useState(false);

  const secretMissing = (stored: boolean, value: string) => !stored && value === "";
  const schema = z
    .object({
      provider: z.enum(providers),
      fromName: z.string().trim().min(1, say("required")).max(100),
      fromAddress: z.email(t("errors.address")),
      replyTo: z.union([z.literal(""), z.email(t("errors.address"))]),
      smtp: z.object({
        host: z.string().max(255),
        port: z.string().regex(/^\d{0,5}$/, t("errors.port")),
        security: z.enum(securities),
        username: z.string().max(255),
        password: z.string().max(500),
      }),
      ses: z.object({
        region: z.string().max(40),
        accessKeyId: z.string().max(128),
        secretAccessKey: z.string().max(500),
        configurationSet: z.string().max(64),
        eventsTopicArn: z.string().max(300),
      }),
      resend: z.object({ apiKey: z.string().max(500), webhookSecret: z.string().max(500) }),
    })
    .superRefine((values, context) => {
      const need = (path: string[], missing: boolean) =>
        missing && context.addIssue({ code: "custom", path, message: say("required") });
      if (values.provider === "smtp") {
        need(["smtp", "host"], !values.smtp.host.trim());
        need(["smtp", "port"], !values.smtp.port.trim());
      }
      if (values.provider === "ses") {
        need(["ses", "region"], !values.ses.region.trim());
        need(["ses", "accessKeyId"], !values.ses.accessKeyId.trim());
        need(
          ["ses", "secretAccessKey"],
          secretMissing(sesSecretKept(values), values.ses.secretAccessKey),
        );
      }
      if (values.provider === "resend") {
        need(["resend", "apiKey"], secretMissing(current.resend.apiKeySet, values.resend.apiKey));
      }
    });

  /** A stored SES secret is reused only for the same region and access key, as Keycloak does. */
  function sesSecretKept(values: Values) {
    return (
      current.ses.secretAccessKeySet &&
      values.ses.region.trim() === (current.ses.region ?? "") &&
      values.ses.accessKeyId.trim() === (current.ses.accessKeyId ?? "")
    );
  }

  /** A stored SMTP password is reused only for the same server and login. */
  function smtpPasswordKept(values: Values) {
    return (
      current.smtp.passwordSet &&
      values.smtp.host.trim() === (current.smtp.host ?? "") &&
      values.smtp.port.trim() === String(current.smtp.port ?? "") &&
      values.smtp.username.trim() === (current.smtp.username ?? "")
    );
  }

  const form = useAppForm({
    defaultValues: valuesOf(settings),
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data } = await saveEmailSettings({ body: bodyOf(value, current.version) });
        setCurrent(data);
        formApi.reset(valuesOf(data));
        notify.success("Admin.email.settings.saved");
        router.refresh();
      } catch (error) {
        const code = error instanceof ApiError ? error.code : undefined;
        setServerErrors(formApi, {
          form:
            code === "NOTIFICATION_SETTINGS_CHANGED"
              ? t("errors.changed")
              : code === "NOTIFICATION_SETTINGS_INCOMPLETE"
                ? t("errors.incomplete")
                : code === "NOTIFICATION_ENCRYPTION_KEY_MISSING"
                  ? t("errors.encryption")
                  : t("errors.unknown"),
          fields: {},
        });
      }
    },
  });

  const values = useStore(form.store, (state) => state.values);
  const dirty = useStore(form.store, (state) => state.isDirty);

  async function test(to: string) {
    const errors = await form.validateAllFields("submit");
    if (errors.length > 0 || !form.state.isValid) {
      return;
    }
    setTesting(true);
    try {
      const { data } = await testEmailSettings({
        body: bodyOf(form.state.values, current.version),
        query: { to },
      });
      if (data.sent) {
        notify.success("Admin.email.settings.testSent", { email: data.recipient });
      } else {
        notify.error(testFailures[data.failure ?? "unavailable"]);
      }
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      notify.error(
        (code === undefined ? undefined : testRefusals[code]) ??
          (code === "NOTIFICATION_SETTINGS_INCOMPLETE"
            ? "Admin.email.settings.errors.incomplete"
            : code === "NOTIFICATION_ENCRYPTION_KEY_MISSING"
              ? "Admin.email.settings.errors.encryption"
              : "Admin.email.settings.errors.unknown"),
      );
    } finally {
      setTesting(false);
    }
  }

  /** What a secret field says under it: saved and kept when left empty, or what it is. */
  const secretHint = (kept: boolean, what: string) => (kept ? t("secretKept") : what);

  return (
    <form
      noValidate
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      {!current.encryptionReady && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-destructive/40 px-4 py-3"
        >
          <KeyRoundIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("encryption.title")}</p>
            <p className="text-sm text-muted-foreground">{t("encryption.description")}</p>
          </div>
        </div>
      )}
      {current.encryptionReady && !current.ready && (
        <div role="status" className="flex items-start gap-3 rounded-lg border bg-accent px-4 py-3">
          <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium">{t("notReady.title")}</p>
            <p className="text-sm text-muted-foreground">{t("notReady.description")}</p>
          </div>
        </div>
      )}

      <form.AppForm>
        <form.FormError />
      </form.AppForm>

      <div className="flex flex-col gap-8">
        <Section title={t("sender.title")} what={t("sender.what")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <form.AppField name="fromName">
              {(field) => <field.TextField label={t("sender.fromName")} maxLength={100} />}
            </form.AppField>
            <form.AppField name="fromAddress">
              {(field) => (
                <field.TextField
                  label={t("sender.fromAddress")}
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={254}
                  placeholder="no-reply@beyondpilot.ai"
                />
              )}
            </form.AppField>
          </div>
          <form.AppField name="replyTo">
            {(field) => (
              <field.TextField
                label={t("sender.replyTo")}
                optional
                type="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                description={t("sender.replyToHint")}
              />
            )}
          </form.AppField>
        </Section>

        <Section title={t("provider.title")} what={t("provider.what")}>
          <form.Field name="provider">
            {(field) => (
              <RadioGroup
                aria-label={t("provider.title")}
                value={field.state.value}
                onValueChange={(value) => {
                  const next = providers.find((provider) => provider === value);
                  if (next) {
                    field.handleChange(next);
                  }
                }}
                className="sm:grid-cols-3"
              >
                {providers.map((provider) => {
                  const Icon = providerIcons[provider];
                  return (
                    <FieldLabel key={provider} htmlFor={`provider-${provider}`}>
                      <Field orientation="horizontal">
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <FieldContent>
                          <FieldTitle>{names(`${provider}.name`)}</FieldTitle>
                        </FieldContent>
                        <RadioGroupItem value={provider} id={`provider-${provider}`} />
                      </Field>
                    </FieldLabel>
                  );
                })}
              </RadioGroup>
            )}
          </form.Field>

          {values.provider === "ses" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.AppField name="ses.region">
                  {(field) => (
                    <field.TextField
                      label={t("ses.region")}
                      placeholder="ap-southeast-1"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={40}
                    />
                  )}
                </form.AppField>
                <form.AppField name="ses.accessKeyId">
                  {(field) => (
                    <field.TextField
                      label={t("ses.accessKeyId")}
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={128}
                    />
                  )}
                </form.AppField>
              </div>
              <form.AppField name="ses.secretAccessKey">
                {(field) => (
                  <field.TextField
                    label={t("ses.secretAccessKey")}
                    type="password"
                    autoComplete="off"
                    maxLength={500}
                    placeholder={sesSecretKept(values) ? "••••••••••••" : undefined}
                    description={secretHint(sesSecretKept(values), t("ses.secretHint"))}
                  />
                )}
              </form.AppField>
            </>
          )}

          {values.provider === "resend" && (
            <form.AppField name="resend.apiKey">
              {(field) => (
                <field.TextField
                  label={t("resend.apiKey")}
                  type="password"
                  autoComplete="off"
                  maxLength={500}
                  placeholder={current.resend.apiKeySet ? "••••••••••••" : "re_…"}
                  description={secretHint(current.resend.apiKeySet, t("resend.apiKeyHint"))}
                />
              )}
            </form.AppField>
          )}

          {values.provider === "smtp" && (
            <>
              <div className="grid gap-5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <form.AppField name="smtp.host">
                    {(field) => (
                      <field.TextField
                        label={t("smtp.host")}
                        placeholder="smtp.example.com"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={255}
                      />
                    )}
                  </form.AppField>
                </div>
                <form.AppField name="smtp.port">
                  {(field) => (
                    <field.TextField label={t("smtp.port")} inputMode="numeric" maxLength={5} />
                  )}
                </form.AppField>
              </div>
              <form.AppField name="smtp.security">
                {(field) => (
                  <field.SelectField
                    label={t("smtp.security")}
                    options={securities.map((value) => ({
                      value,
                      label: t(`smtp.securities.${value}`),
                    }))}
                  />
                )}
              </form.AppField>
              <div className="grid gap-5 sm:grid-cols-2">
                <form.AppField name="smtp.username">
                  {(field) => (
                    <field.TextField
                      label={t("smtp.username")}
                      optional
                      autoCapitalize="none"
                      spellCheck={false}
                      autoComplete="off"
                      maxLength={255}
                    />
                  )}
                </form.AppField>
                <form.AppField name="smtp.password">
                  {(field) => (
                    <field.TextField
                      label={t("smtp.password")}
                      optional
                      type="password"
                      autoComplete="off"
                      maxLength={500}
                      placeholder={smtpPasswordKept(values) ? "••••••••••••" : undefined}
                      description={secretHint(smtpPasswordKept(values), t("smtp.passwordHint"))}
                    />
                  )}
                </form.AppField>
              </div>
            </>
          )}
        </Section>

        <Section title={t("reports.title")} what={t("reports.what")}>
          {values.provider === "smtp" && (
            <p className="text-sm text-muted-foreground">{t("reports.smtp")}</p>
          )}
          {values.provider === "resend" && (
            <>
              <CopyField
                id="resend-events-url"
                label={t("reports.endpoint")}
                value={current.resend.eventsUrl}
                description={t("reports.resendEndpointHint")}
              />
              <form.AppField name="resend.webhookSecret">
                {(field) => (
                  <field.TextField
                    label={t("reports.resendSecret")}
                    optional
                    type="password"
                    autoComplete="off"
                    maxLength={500}
                    placeholder={current.resend.webhookSecretSet ? "••••••••••••" : "whsec_…"}
                    description={secretHint(
                      current.resend.webhookSecretSet,
                      t("reports.resendSecretHint"),
                    )}
                  />
                )}
              </form.AppField>
            </>
          )}
          {values.provider === "ses" && (
            <>
              <form.AppField name="ses.configurationSet">
                {(field) => (
                  <field.TextField
                    label={t("reports.configurationSet")}
                    optional
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={64}
                    description={t("reports.configurationSetHint")}
                  />
                )}
              </form.AppField>
              <CopyField
                id="ses-events-url"
                label={t("reports.endpoint")}
                value={current.ses.eventsUrl}
                description={t("reports.sesEndpointHint")}
              />
              <form.AppField name="ses.eventsTopicArn">
                {(field) => (
                  <field.TextField
                    label={t("reports.topicArn")}
                    optional
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={300}
                    className="font-mono"
                    placeholder="arn:aws:sns:ap-southeast-1:123456789012:beyondpilot-email"
                    description={t("reports.topicArnHint")}
                  />
                )}
              </form.AppField>
            </>
          )}
        </Section>
      </div>

      <div className="-mx-4 flex flex-col gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur md:sticky md:bottom-0 md:-mx-6 md:flex-row md:items-center md:px-6 lg:-mx-8 lg:px-8">
        <p className="flex-1 text-xs text-muted-foreground">
          {dirty
            ? t("unsaved")
            : current.updatedBy && current.updatedAt
              ? t("lastSaved", {
                  name: current.updatedBy,
                  when: format.dateTime(new Date(current.updatedAt), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
                })
              : t("neverSaved")}
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <TestSend defaultTo={operatorEmail} pending={testing} onSend={(to) => void test(to)} />
          <form.AppForm>
            <form.SubmitButton>{t("save")}</form.SubmitButton>
          </form.AppForm>
        </div>
      </div>

      <LeaveGuard
        active={dirty}
        title={t("leave.title")}
        description={t("leave.lead")}
        leaveLabel={t("leave.leave")}
        stayLabel={t("leave.stay")}
      />
    </form>
  );
}

export { EmailSettingsForm };
