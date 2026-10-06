import { CircleAlertIcon, CircleCheckIcon, TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVocabulary } from "@/i18n/vocabulary";
import type { MyTalent, TalentEnquiry } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { DeleteTalentProfile } from "./delete-talent-profile";
import { TalentEnquiryActions } from "./talent-enquiry-actions";
import { TalentForm } from "./talent-form";
import { TalentStatus } from "./talent-status";

type MyTalentPageProps = {
  mine: MyTalent;
  /** The name of the caller's account, to start a new profile with. */
  accountName: string;
};

/**
 * My talent profile: where its review stands, its editor, and the messages people sent through it.
 * A person without a profile sees the same editor, empty.
 */
function MyTalentPage({ mine, accountName }: MyTalentPageProps) {
  const t = useTranslations("Talent.mine");
  const reason = useVocabulary("talentRejection");
  const profile = mine.profile ?? null;
  const waiting = mine.enquiries.filter((enquiry) => enquiry.status === "pending").length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 md:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {profile && <TalentStatus status={profile.status} />}
        </div>
        <p className="max-w-2xl text-muted-foreground">{t(profile ? "lead" : "leadNew")}</p>
      </div>

      {profile?.status === "submitted" && (
        <Alert className="max-w-3xl">
          <TimerIcon aria-hidden="true" />
          <AlertTitle>{t("submitted.title")}</AlertTitle>
          <AlertDescription>{t("submitted.lead")}</AlertDescription>
        </Alert>
      )}
      {profile?.status === "approved" && (
        <Alert className="max-w-3xl">
          <CircleCheckIcon aria-hidden="true" />
          <AlertTitle>{t(profile.listed ? "approved.listed" : "approved.unlisted")}</AlertTitle>
          <AlertDescription>
            {profile.listed ? (
              <TextButton href={`${siteRoutes.talent}/${profile.slug}`}>
                {t("approved.open")}
              </TextButton>
            ) : (
              t("approved.unlistedLead")
            )}
          </AlertDescription>
        </Alert>
      )}
      {(profile?.status === "changes_requested" || profile?.status === "removed") && (
        <Alert variant="destructive" className="max-w-3xl">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>
            {t(profile.status === "removed" ? "removed.title" : "changesRequested.title", {
              reason: reason(profile.decisionReason ?? "other"),
            })}
          </AlertTitle>
          <AlertDescription>
            {profile.decisionMessage && <p>{profile.decisionMessage}</p>}
            <p>{t(profile.status === "removed" ? "removed.lead" : "changesRequested.lead")}</p>
          </AlertDescription>
        </Alert>
      )}

      {mine.enquiries.length > 0 && (
        <section aria-labelledby="talent-enquiries" className="flex max-w-3xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="talent-enquiries" className="text-lg font-semibold">
              {t("inbox.title")}
            </h2>
            {waiting > 0 && (
              <p className="text-sm font-medium">{t("inbox.waiting", { count: waiting })}</p>
            )}
            <p className="text-sm text-muted-foreground">{t("inbox.lead")}</p>
          </div>
          <ul className="overflow-hidden rounded-lg border bg-background">
            {mine.enquiries.map((enquiry) => (
              <EnquiryItem key={enquiry.id} enquiry={enquiry} />
            ))}
          </ul>
        </section>
      )}

      {/* The key gives a saved profile a fresh form, so it holds the new version. */}
      <TalentForm
        key={profile ? `${profile.version}-${profile.status}` : "new"}
        profile={profile}
        suggestedName={accountName}
      />
      {profile && <DeleteTalentProfile />}
    </div>
  );
}

const tones = {
  pending: "warning",
  accepted: "success",
  declined: "neutral",
  reported: "neutral",
  closed: "neutral",
} as const;

/**
 * One message: who wrote, from where and about what, where it stands, and the answers while it
 * waits. The sender's address shows only once the caller accepted.
 */
function EnquiryItem({ enquiry }: { enquiry: TalentEnquiry }) {
  const t = useTranslations("Talent.mine.inbox");
  const topic = useVocabulary("enquiryTopic");
  const format = useFormatter();
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium" });
  const name = enquiry.senderName ?? t("someone");

  return (
    <li className="flex flex-col gap-3 p-4 not-last:border-b">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="grid min-w-0 gap-0.5 text-sm">
          <span className="font-medium">
            {enquiry.senderOrganization
              ? t("from", { name, organization: enquiry.senderOrganization })
              : name}
          </span>
          <span className="text-muted-foreground">{topic(enquiry.topic)}</span>
        </div>
        <Status tone={tones[enquiry.status]}>{t(`status.${enquiry.status}`)}</Status>
      </div>
      <p className="text-sm whitespace-pre-line">{enquiry.message}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {t("sent", { date: date(enquiry.createdAt) })}
          {enquiry.closesAt && ` · ${t("closes", { date: date(enquiry.closesAt) })}`}
          {enquiry.status !== "pending" &&
            enquiry.answeredAt &&
            ` · ${t("answered", { date: date(enquiry.answeredAt) })}`}
        </span>
        {enquiry.status === "pending" && <TalentEnquiryActions id={enquiry.id} />}
        {enquiry.status === "accepted" && enquiry.senderEmail && (
          <TextButton href={`mailto:${enquiry.senderEmail}`} size="sm">
            {t("write", { email: enquiry.senderEmail })}
          </TextButton>
        )}
      </div>
    </li>
  );
}

export { MyTalentPage };
