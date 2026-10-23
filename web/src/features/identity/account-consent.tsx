"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
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

/** Where requests about personal data go, as the privacy policy names it. */
const PRIVACY_ADDRESS = "team@beyondpilot.ai";

/** The purposes a person turns on or off here; using the platform is withdrawn on its own row. */
const choosable = purposes.filter((purpose) => purpose !== "platform");

/**
 * Privacy and data in Settings (BEY-240), as products lay out their data controls: a switch for
 * each optional purpose, then where to ask about one's data, then withdrawing the consent to use
 * the platform. A switch takes effect at once and offers Undo. The consent to use the platform is
 * no switch beside them: withdrawing it stops the person using BeyondPilot until they agree again,
 * so it is asked once and then leads to the consent step. The full text can be read again and
 * answered there.
 */
function AccountConsent({ consent }: { consent: Consent }) {
  const t = useTranslations("Consent");
  const notify = useNotify();
  const router = useRouter();
  const [choices, setChoices] = useState(() => choicesOf(consent));
  const [reading, setReading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [pending, setPending] = useState(false);

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
    <section
      aria-labelledby="privacy-and-data"
      className="flex flex-col gap-1 rounded-2xl border bg-card p-5 md:p-6"
    >
      <div className="flex flex-col gap-1 pb-2">
        <h2 id="privacy-and-data" className="text-base font-medium">
          {t("settings.title")}
        </h2>
        <p className="text-sm text-pretty text-muted-foreground">
          {t.rich("settings.lead", {
            read: (chunks) => <TextButton onClick={() => setReading(true)}>{chunks}</TextButton>,
          })}
        </p>
      </div>
      <ul className="flex flex-col divide-y">
        {choosable.map((purpose) => {
          const id = `consent-switch-${purpose}`;
          return (
            <li key={purpose} className="flex items-start justify-between gap-6 py-4">
              <div className="flex flex-col gap-1">
                <label htmlFor={id} className="text-sm font-medium">
                  {t(`purposes.${purpose}.short`)}
                </label>
                <p id={`${id}-hint`} className="text-sm text-pretty text-muted-foreground">
                  {t(`purposes.${purpose}.setting`)}
                </p>
              </div>
              <Switch
                id={id}
                className="mt-1"
                checked={choices[purpose]}
                disabled={pending}
                aria-describedby={`${id}-hint`}
                onCheckedChange={(on) => void turn(purpose, on)}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-col divide-y border-t">
        <SettingRow title={t("settings.data.title")} description={t("settings.data.description")}>
          <Button
            prominence="secondary"
            className="max-sm:w-full"
            href={`mailto:${PRIVACY_ADDRESS}`}
          >
            {t("settings.data.action")}
          </Button>
        </SettingRow>
        <SettingRow
          title={t("settings.withdrawRow.title")}
          description={t("settings.withdrawRow.description")}
        >
          <Button
            tone="danger"
            prominence="secondary"
            className="max-sm:w-full"
            onClick={() => setWithdrawing(true)}
          >
            {t("settings.withdrawRow.action")}
          </Button>
        </SettingRow>
      </div>
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

/** A row that leads to an action: what it is and what follows, with its button beside it, or below on a phone. */
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 pt-4 not-last:pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-pretty text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export { AccountConsent };
