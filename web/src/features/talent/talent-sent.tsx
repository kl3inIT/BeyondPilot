"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { SentTalentEnquiry } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

const tones = {
  pending: "info",
  accepted: "success",
  declined: "neutral",
  closed: "neutral",
} as const;

/** What the caller wrote to one person: the latest message, then the earlier ones, the newest first. */
type Thread = { latest: SentTalentEnquiry; earlier: SentTalentEnquiry[] };

/** One thread per person, in the order the messages arrive: those that wait first, then the newest. */
function threads(enquiries: SentTalentEnquiry[]): Thread[] {
  const byPerson = new Map<string, Thread>();
  for (const enquiry of enquiries) {
    const thread = byPerson.get(enquiry.profileId);
    if (thread) {
      thread.earlier.push(enquiry);
    } else {
      byPerson.set(enquiry.profileId, { latest: enquiry, earlier: [] });
    }
  }
  return [...byPerson.values()];
}

/**
 * The messages the caller sent through talent profiles, as the Figma frames "Messages you sent"
 * draw them: one row per person on one side, the latest message to the person chosen in full on
 * the other, with the earlier ones under it. The first that waits for an answer opens first.
 */
function TalentSent({ enquiries }: { enquiries: SentTalentEnquiry[] }) {
  const t = useTranslations("Talent.sent");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const people = threads(enquiries);
  const [chosen, setChosen] = useState(people[0]?.latest.profileId);
  const open = people.find((thread) => thread.latest.profileId === chosen);

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2 xl:gap-6">
      <ul aria-label={t("list")} className="overflow-hidden rounded-2xl border bg-card">
        {people.map(({ latest }) => {
          const active = latest.profileId === chosen;
          return (
            <li key={latest.profileId} className="not-last:border-b">
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => setChosen(latest.profileId)}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-5 py-4 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                  active && "bg-accent hover:bg-accent",
                )}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium">
                    {latest.recipientName}
                  </span>
                  <Status tone={tones[latest.status]}>{t(`status.${latest.status}`)}</Status>
                </span>
                <span className="flex justify-between gap-3 text-sm text-muted-foreground">
                  <span className="truncate">{topic(latest.topic)}</span>
                  <span className="shrink-0 tabular-nums">
                    {format.dateTime(new Date(latest.createdAt), { dateStyle: "medium" })}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <SentDetail key={open.latest.id} thread={open} />}
    </div>
  );
}

/**
 * The latest message to one person in full: where it stands, what was written and under which
 * name, the person's address once they accepted, and what the caller wrote to them before.
 */
function SentDetail({ thread: { latest, earlier } }: { thread: Thread }) {
  const t = useTranslations("Talent.sent");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const name = latest.recipientName;
  const email = latest.status === "accepted" ? latest.recipientEmail : null;
  const over = latest.status === "declined" || latest.status === "closed";

  return (
    <article
      aria-labelledby="talent-sent-open"
      className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:p-6 lg:sticky lg:top-24"
    >
      <div className="grid gap-1">
        <h2 id="talent-sent-open" className="text-lg font-semibold break-words">
          {t(`heading.${latest.status}`, { name })}
        </h2>
        <p className="text-sm text-muted-foreground">
          {[latest.recipientHeadline, topic(latest.topic)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="grid gap-1.5">
        <h3 className="text-sm font-medium">{t("yourMessage")}</h3>
        <p className="text-sm whitespace-pre-line">{latest.message}</p>
        <p className="text-xs text-muted-foreground">
          {[
            t("sentOn", { date: date(latest.createdAt) }),
            latest.senderName && t("signedAs", { name: latest.senderName }),
            latest.status !== "pending" &&
              latest.answeredAt &&
              t(latest.status === "closed" ? "closedOn" : "answeredOn", {
                date: date(latest.answeredAt),
              }),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Person
        name={name}
        email={email ?? t(`address.${latest.status}`)}
        className="rounded-xl border bg-muted px-3 py-3"
      />
      <p className="text-sm text-muted-foreground">
        {latest.status === "pending" && latest.closesAt
          ? t("note.pending", { name, date: date(latest.closesAt) })
          : t(`note.${latest.status === "pending" ? "closed" : latest.status}`, { name })}
      </p>
      {earlier.length > 0 && (
        <section aria-labelledby="talent-sent-earlier" className="grid gap-3 border-t pt-4">
          <h3 id="talent-sent-earlier" className="text-sm font-medium">
            {t("earlier", { name })}
          </h3>
          <ul className="grid gap-3">
            {earlier.map((enquiry) => (
              <li key={enquiry.id} className="grid gap-1">
                <p className="text-xs text-muted-foreground">
                  {[
                    date(enquiry.createdAt),
                    topic(enquiry.topic),
                    t(`status.${enquiry.status}`),
                  ].join(" · ")}
                </p>
                <p className="text-sm whitespace-pre-line">{enquiry.message}</p>
                {enquiry.status === "accepted" && enquiry.recipientEmail && (
                  <TextButton href={`mailto:${enquiry.recipientEmail}`}>
                    {t("writeTo", { email: enquiry.recipientEmail })}
                  </TextButton>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {(latest.recipientSlug || email || over) && (
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          {latest.recipientSlug && (
            <Button prominence="secondary" href={`${siteRoutes.talent}/${latest.recipientSlug}`}>
              {t("viewProfile")}
            </Button>
          )}
          {email && <Button href={`mailto:${email}`}>{t("write")}</Button>}
          {over && <Button href={siteRoutes.talent}>{t("browse")}</Button>}
        </div>
      )}
    </article>
  );
}

export { TalentSent };
