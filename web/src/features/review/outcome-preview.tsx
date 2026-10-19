"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/components/actions/icon-button";

import { fillOutcome, outcomeParts, type OutcomeRecipient } from "./outcome-placeholders";

type OutcomePreviewProps = {
  /** Where the preview's heading points, for the group it belongs to. */
  id: string;
  subject: string;
  message: string;
  recipients: OutcomeRecipient[];
};

/**
 * One group's email as an applicant of that group gets it, with their organization and solution
 * filled in, one applicant after another. Below the message, the link and the sign-off the email
 * adds by itself, so the message need not carry them.
 */
function OutcomePreview({ id, subject, message, recipients }: OutcomePreviewProps) {
  const t = useTranslations("Review.release.preview");
  const [shown, setShown] = useState(0);
  // The group can shrink while the page is open; the preview never points past its end.
  const index = Math.min(shown, recipients.length - 1);
  const recipient = recipients[index];
  if (!recipient) {
    return null;
  }

  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 id={id} className="text-sm font-medium">
            {t("title")}
          </h3>
          <p className="truncate text-xs text-muted-foreground">
            {t("to", { organization: recipient.organization, solution: recipient.solution })}
          </p>
        </div>
        {recipients.length > 1 && (
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              size="sm"
              prominence="tertiary"
              aria-label={t("previous")}
              disabled={index === 0}
              onClick={() => setShown(index - 1)}
            >
              <ChevronLeftIcon aria-hidden="true" />
            </IconButton>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("position", { index: index + 1, count: recipients.length })}
            </span>
            <IconButton
              size="sm"
              prominence="tertiary"
              aria-label={t("next")}
              disabled={index === recipients.length - 1}
              onClick={() => setShown(index + 1)}
            >
              <ChevronRightIcon aria-hidden="true" />
            </IconButton>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 text-sm">
        <p className="font-medium break-words">{fillOutcome(subject, recipient)}</p>
        <p className="break-words whitespace-pre-line">
          {outcomeParts(message, recipient).map((part, at) =>
            part.href ? (
              <a
                key={at}
                href={part.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {part.text}
              </a>
            ) : (
              part.text
            ),
          )}
        </p>
        <p className="font-medium text-primary underline underline-offset-4">{t("link")}</p>
        <p className="text-muted-foreground">{t("signOff")}</p>
      </div>
    </section>
  );
}

export { OutcomePreview };
