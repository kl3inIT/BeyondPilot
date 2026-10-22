"use client";

import { ShieldCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { BrandMark } from "@/components/layout/brand-mark";
import { useNotify } from "@/hooks/use-notify";
import { recordMyConsent, type Consent } from "@/lib/api/generated";
import { signOut } from "@/lib/auth/sign-out";
import { siteRoutes } from "@/lib/site";

import {
  choicesOf,
  everything,
  purposes,
  type ChoiceSource,
  type Choices,
} from "./consent-choices";
import { ConsentDialog } from "./consent-dialog";
import { PurposeBadge, purposeIcons } from "./consent-purpose";

type ConsentStepProps = {
  consent: Consent;
  /** Where the person was going, with its locale; they go on there once they have agreed. */
  next: string;
  /** The home page, with its locale, where signing out leads. */
  home: string;
};

/**
 * The step a signed-in person takes before using the platform (BEY-240): what Accept all turns on,
 * and the way to choose one purpose at a time in the full text. Signing out is the way out for
 * someone who does not agree. Agreeing leads on with a full page load, so every part of the page
 * reads the account again.
 */
function ConsentStep({ consent, next, home }: ConsentStepProps) {
  const t = useTranslations("Consent");
  const notify = useNotify();
  const [choosing, setChoosing] = useState(false);
  const [pending, setPending] = useState(false);

  async function save(choices: Choices, source: ChoiceSource) {
    setPending(true);
    try {
      await recordMyConsent({ body: { ...choices, source } });
      window.location.assign(next);
    } catch (error) {
      notify.failure(error, { otherwise: "Consent.failed" });
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <span className="flex size-12 items-center justify-center rounded-md border bg-background">
        <BrandMark size={26} className="size-6.5" />
      </span>
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-balance">{t("title")}</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {t.rich("lead", {
            terms: (chunks) => (
              <TextButton href={siteRoutes.terms} className="whitespace-normal">
                {chunks}
              </TextButton>
            ),
            privacy: (chunks) => (
              <TextButton href={siteRoutes.privacy} className="whitespace-normal">
                {chunks}
              </TextButton>
            ),
            text: (chunks) => (
              <TextButton className="whitespace-normal" onClick={() => setChoosing(true)}>
                {chunks}
              </TextButton>
            ),
          })}
        </p>
      </div>
      <section className="flex w-full flex-col gap-3 rounded-xl border bg-background p-4">
        <h2 className="text-sm font-medium">{t("summary")}</h2>
        <ul className="flex flex-col gap-3">
          {purposes.map((purpose) => {
            const Icon = purposeIcons[purpose];
            return (
              <li key={purpose} className="flex items-start gap-2.5 text-sm">
                <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="flex-1">{t(`purposes.${purpose}.short`)}</span>
                <PurposeBadge purpose={purpose} />
              </li>
            );
          })}
        </ul>
        <p className="flex gap-2.5 border-t pt-3 text-sm text-muted-foreground">
          <ShieldCheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success" />
          {t("later")}
        </p>
      </section>
      <div className="flex w-full flex-col gap-2">
        <Button
          size="lg"
          className="w-full"
          pending={pending && !choosing}
          disabled={pending}
          onClick={() => void save(everything, "accept_all")}
        >
          {t("acceptAll")}
        </Button>
        <Button
          size="lg"
          prominence="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => setChoosing(true)}
        >
          {t("choose")}
        </Button>
      </div>
      <TextButton
        size="sm"
        disabled={pending}
        onClick={async () => {
          await signOut();
          window.location.assign(home);
        }}
      >
        {t("signOut")}
      </TextButton>
      <ConsentDialog
        open={choosing}
        onOpenChange={setChoosing}
        consent={consent}
        initial={choicesOf(consent)}
        pending={pending}
        onSave={(choices, source) => void save(choices, source)}
      />
    </div>
  );
}

export { ConsentStep };
