"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { useVocabulary } from "@/i18n/vocabulary";
import type { TalentEnquiry } from "@/lib/api/generated";

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
      <Card size="sm">
        <CardContent>
          <ItemGroup aria-label={t("list")}>
            {enquiries.map((enquiry) => {
              const name = enquiry.senderName ?? t("someone");
              const active = enquiry.id === chosen;
              return (
                <div key={enquiry.id} role="listitem">
                  <Item
                    size="sm"
                    variant={active ? "muted" : "default"}
                    render={
                      <button
                        type="button"
                        aria-current={active ? "true" : undefined}
                        onClick={() => setChosen(enquiry.id)}
                      />
                    }
                  >
                    <ItemContent>
                      <ItemTitle>
                        {enquiry.senderOrganization
                          ? t("from", { name, organization: enquiry.senderOrganization })
                          : name}
                      </ItemTitle>
                      <ItemDescription>{topic(enquiry.topic)}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <div className="flex flex-col items-end gap-1">
                        <Status tone={tones[enquiry.status]}>
                          {t(`status.${enquiry.status}`)}
                        </Status>
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {format.dateTime(new Date(enquiry.createdAt), { dateStyle: "medium" })}
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
      {open ? (
        <EnquiryDetail key={open.id} enquiry={open} />
      ) : (
        <Card size="lg">
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyDescription>{t("choose")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
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
    <article aria-labelledby="talent-enquiry-open" className="lg:sticky lg:top-24">
      <Card size="lg">
        <CardHeader>
          <CardTitle>
            <h3 id="talent-enquiry-open" className="break-words">
              {enquiry.senderOrganization
                ? t("from", { name, organization: enquiry.senderOrganization })
                : name}
            </h3>
          </CardTitle>
          <CardDescription>{topic(enquiry.topic)}</CardDescription>
          <CardAction>
            <Status tone={tones[enquiry.status]}>{t(`status.${enquiry.status}`)}</Status>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="whitespace-pre-line">{enquiry.message}</p>
            <p className="text-xs text-muted-foreground">
              {t("sent", { date: date(enquiry.createdAt) })}
              {enquiry.closesAt && ` · ${t("closes", { date: date(enquiry.closesAt) })}`}
              {enquiry.status !== "pending" &&
                enquiry.answeredAt &&
                ` · ${t("answered", { date: date(enquiry.answeredAt) })}`}
            </p>
          </div>
        </CardContent>
        {enquiry.status === "pending" && (
          <CardFooter>
            <TalentEnquiryActions id={enquiry.id} />
          </CardFooter>
        )}
        {enquiry.status === "accepted" && enquiry.senderEmail && (
          <CardFooter>
            <TextButton href={`mailto:${enquiry.senderEmail}`}>
              {t("write", { email: enquiry.senderEmail })}
            </TextButton>
          </CardFooter>
        )}
      </Card>
    </article>
  );
}

export { TalentInbox };
