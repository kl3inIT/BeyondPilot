"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Person } from "@/components/composites/person";
import { Status } from "@/components/composites/status";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { useVocabulary } from "@/i18n/vocabulary";
import type { SentTalentEnquiry } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

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
      <Card size="sm">
        <CardContent>
          <ItemGroup aria-label={t("list")}>
            {people.map(({ latest }) => {
              const active = latest.profileId === chosen;
              return (
                <div key={latest.profileId} role="listitem">
                  <Item
                    size="sm"
                    variant={active ? "muted" : "default"}
                    render={
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setChosen(latest.profileId)}
                      />
                    }
                  >
                    <ItemContent>
                      <ItemTitle>{latest.recipientName}</ItemTitle>
                      <ItemDescription>{topic(latest.topic)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <div className="flex flex-col items-end gap-1">
                        <Status tone={tones[latest.status]}>{t(`status.${latest.status}`)}</Status>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {format.dateTime(new Date(latest.createdAt), { dateStyle: "medium" })}
                        </span>
                      </div>
                    </ItemActions>
                  </Item>
                </div>
              );
            })}
          </ItemGroup>
        </CardContent>
      </Card>
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
    <article aria-labelledby="talent-sent-open" className="lg:sticky lg:top-24">
      <Card size="lg">
        <CardHeader>
          <CardTitle>
            <h2 id="talent-sent-open" className="break-words">
              {t(`heading.${latest.status}`, { name })}
            </h2>
          </CardTitle>
          <CardDescription>
            {[latest.recipientHeadline, topic(latest.topic)].filter(Boolean).join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <h3 className="font-medium">{t("yourMessage")}</h3>
              <p className="whitespace-pre-line">{latest.message}</p>
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
            <Item variant="muted">
              <Person name={name} email={email ?? t(`address.${latest.status}`)} />
            </Item>
            <p className="text-muted-foreground">
              {latest.status === "pending" && latest.closesAt
                ? t("note.pending", { name, date: date(latest.closesAt) })
                : t(`note.${latest.status === "pending" ? "closed" : latest.status}`, { name })}
            </p>
            {earlier.length > 0 && (
              <>
                <Separator />
                <section aria-labelledby="talent-sent-earlier" className="flex flex-col gap-3">
                  <h3 id="talent-sent-earlier" className="font-medium">
                    {t("earlier", { name })}
                  </h3>
                  <ul className="flex flex-col gap-3">
                    {earlier.map((enquiry) => (
                      <li key={enquiry.id} className="flex flex-col items-start gap-1">
                        <p className="text-xs text-muted-foreground">
                          {[
                            date(enquiry.createdAt),
                            topic(enquiry.topic),
                            t(`status.${enquiry.status}`),
                          ].join(" · ")}
                        </p>
                        <p className="whitespace-pre-line">{enquiry.message}</p>
                        {enquiry.status === "accepted" && enquiry.recipientEmail && (
                          <TextButton href={`mailto:${enquiry.recipientEmail}`}>
                            {t("writeTo", { email: enquiry.recipientEmail })}
                          </TextButton>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </div>
        </CardContent>
        {(latest.recipientSlug || email || over) && (
          <CardFooter>
            <div className="flex w-full flex-wrap justify-end gap-2">
              {latest.recipientSlug && (
                <Button
                  prominence="secondary"
                  href={`${siteRoutes.talent}/${latest.recipientSlug}`}
                >
                  {t("viewProfile")}
                </Button>
              )}
              {email && <Button href={`mailto:${email}`}>{t("write")}</Button>}
              {over && <Button href={siteRoutes.talent}>{t("browse")}</Button>}
            </div>
          </CardFooter>
        )}
      </Card>
    </article>
  );
}

export { TalentSent };
