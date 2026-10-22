"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import { useFormatter } from "@/i18n/format";
import { recordMyConsent, type Consent } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import {
  choicesOf,
  purposes,
  type ChoiceSource,
  type Choices,
  type Purpose,
} from "./consent-choices";
import { ConsentDialog } from "./consent-dialog";
import { PurposeBadge, purposeIcons } from "./consent-purpose";

/** Where requests about personal data go, as the privacy policy names it. */
const PRIVACY_ADDRESS = "team@beyondpilot.ai";

/**
 * Privacy and consent in Settings (BEY-240): a switch for each purpose. Turning an optional one off
 * or on takes effect at once and offers Undo; withdrawing the consent to use the platform locks the
 * account, so it is asked once and then leads to the consent step. The full text can be read again
 * and answered there.
 */
function AccountConsent({ consent }: { consent: Consent }) {
  const t = useTranslations("Consent");
  const format = useFormatter();
  const notify = useNotify();
  const router = useRouter();
  const [choices, setChoices] = useState(() => choicesOf(consent));
  const [reading, setReading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pending, setPending] = useState(false);
  const agreedAt = consent.purposes.find((purpose) => purpose.key === "platform")?.answeredAt;

  async function save(next: Choices, source: ChoiceSource): Promise<boolean> {
    setPending(true);
    try {
      const { data } = await recordMyConsent({ body: { ...next, source } });
      setChoices(choicesOf(data));
      return true;
    } catch (error) {
      notify.failure(error, { otherwise: "Consent.failed" });
      return false;
    } finally {
      setPending(false);
    }
  }

  async function turn(purpose: Purpose, on: boolean) {
    const before = choices;
    if (await save({ ...choices, [purpose]: on }, "settings")) {
      notify.success(
        on ? "Consent.settings.turnedOn" : "Consent.settings.turnedOff",
        { purpose: t(`purposes.${purpose}.short`) },
        { undo: () => void save(before, "undo") },
      );
    }
  }

  return (
    <section className="flex flex-col gap-1 rounded-2xl border bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-3">
        <h2 className="text-base font-medium">{t("settings.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {agreedAt &&
            t("settings.agreed", {
              version: consent.version,
              date: format.dateTime(new Date(agreedAt), "date"),
            })}{" "}
          <TextButton onClick={() => setReading(true)}>{t("settings.read")}</TextButton>
        </p>
      </div>
      <ul className="flex flex-col divide-y">
        {purposes.map((purpose) => {
          const Icon = purposeIcons[purpose];
          const id = `consent-switch-${purpose}`;
          return (
            <li key={purpose} className="flex items-start gap-3 py-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor={id} className="text-sm font-medium">
                    {t(`purposes.${purpose}.short`)}
                  </label>
                  <PurposeBadge purpose={purpose} />
                </div>
                <p id={`${id}-hint`} className="text-sm text-pretty text-muted-foreground">
                  {t(`purposes.${purpose}.without`)}
                </p>
              </div>
              <Switch
                id={id}
                className="mt-1"
                checked={choices[purpose]}
                disabled={pending}
                aria-describedby={`${id}-hint`}
                onCheckedChange={(on) => {
                  if (purpose === "platform" && !on) {
                    setWithdrawing(true);
                    return;
                  }
                  void turn(purpose, on);
                }}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-1 border-t pt-4 text-sm text-muted-foreground">
        {t.rich("settings.requests", {
          mail: (chunks) => (
            <a
              href={`mailto:${PRIVACY_ADDRESS}`}
              className="underline underline-offset-3 hover:text-foreground"
            >
              {chunks}
            </a>
          ),
        })}
      </p>
      <ConsentDialog
        open={reading}
        onOpenChange={setReading}
        consent={consent}
        initial={choices}
        pending={pending}
        onSave={async (next, source) => {
          if (await save(next, source === "choose" ? "settings" : source)) {
            setReading(false);
          }
        }}
      />
      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        tone="danger"
        title={t("settings.withdraw.title")}
        description={t("settings.withdraw.description")}
        note={t("settings.withdraw.note")}
        cancelLabel={t("settings.withdraw.keep")}
        confirmLabel={t("settings.withdraw.confirm")}
        pending={pending}
        onConfirm={async () => {
          if (await save({ ...choices, platform: false }, "settings")) {
            setWithdrawing(false);
            router.replace(siteRoutes.consent);
          }
        }}
      />
    </section>
  );
}

export { AccountConsent };
