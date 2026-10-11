"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { TalentEnquiry } from "@/lib/api/generated";
import { cn } from "@/lib/utils";

import { TalentEnquiryActions } from "./talent-enquiry-actions";

const tones = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
  reported: "neutral",
  closed: "neutral",
} as const;

/**
 * The enquiries people sent through the profile, as the Figma frame "My talent profile — Enquiries,
 * received, one open" draws it: the list on one side, the enquiry chosen in full on the other, so
 * reading one does not hide the rest. The first that waits for an answer opens first.
 */
function TalentInbox({ enquiries }: { enquiries: TalentEnquiry[] }) {
  const t = useTranslations("Talent.mine.inbox");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const [chosen, setChosen] = useState(
    () => (enquiries.find((enquiry) => enquiry.status === "pending") ?? enquiries[0])?.id,
  );
  const open = enquiries.find((enquiry) => enquiry.id === chosen);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 xl:gap-6">
      <ul aria-label={t("list")} className="overflow-hidden rounded-2xl border bg-card">
        {enquiries.map((enquiry) => {
          const name = enquiry.senderName ?? t("someone");
          const active = enquiry.id === chosen;
          return (
            <li key={enquiry.id} className="not-last:border-b">
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setChosen(enquiry.id)}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-5 py-4 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  active && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {enquiry.senderOrganization
                      ? t("from", { name, organization: enquiry.senderOrganization })
                      : name}
                  </span>
                  <Status tone={tones[enquiry.status]}>{t(`status.${enquiry.status}`)}</Status>
                </span>
                <span className="flex justify-between gap-3 text-sm text-muted-foreground">
                  <span className="truncate">{topic(enquiry.topic)}</span>
                  <span className="shrink-0 tabular-nums">
                    {format.dateTime(new Date(enquiry.createdAt), { dateStyle: "medium" })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <EnquiryDetail key={open.id} enquiry={open} />
      ) : (
        <p className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
          {t("choose")}
        </p>
      )}
    </div>
  );
}

/**
 * One enquiry in full: who wrote, from where and about what, the message, where it stands, and the
 * answers while it waits. The sender's address shows only once the caller accepted.
 */
function EnquiryDetail({ enquiry }: { enquiry: TalentEnquiry }) {
  const t = useTranslations("Talent.mine.inbox");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const name = enquiry.senderName ?? t("someone");

  return (
    <article
      aria-labelledby="talent-enquiry-open"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:p-6 lg:sticky lg:top-24"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h3 id="talent-enquiry-open" className="text-lg font-semibold break-words">
            {enquiry.senderOrganization
              ? t("from", { name, organization: enquiry.senderOrganization })
              : name}
          </h3>
          <p className="text-sm text-muted-foreground">{topic(enquiry.topic)}</p>
        </div>
        <Status tone={tones[enquiry.status]}>{t(`status.${enquiry.status}`)}</Status>
      </div>
      <p className="text-sm whitespace-pre-line">{enquiry.message}</p>
      <p className="text-xs text-muted-foreground">
        {t("sent", { date: date(enquiry.createdAt) })}
        {enquiry.closesAt && ` · ${t("closes", { date: date(enquiry.closesAt) })}`}
        {enquiry.status !== "pending" &&
          enquiry.answeredAt &&
          ` · ${t("answered", { date: date(enquiry.answeredAt) })}`}
      </p>
      {enquiry.status === "pending" && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <TalentEnquiryActions id={enquiry.id} />
        </div>
      )}
      {enquiry.status === "accepted" && enquiry.senderEmail && (
        <div className="border-t pt-4">
          <TextButton href={`mailto:${enquiry.senderEmail}`}>
            {t("write", { email: enquiry.senderEmail })}
          </TextButton>
        </div>
      )}
    </article>
  );
}

export { TalentInbox };
