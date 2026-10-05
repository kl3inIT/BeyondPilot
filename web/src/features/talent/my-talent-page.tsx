import { CircleAlertIcon, CircleCheckIcon, TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus } from "@/components/composites/review-status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useVocabulary } from "@/i18n/vocabulary";
import type { MyTalent } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentForm } from "./talent-form";

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
  const status = useVocabulary("reviewStatus");
  const reason = useVocabulary("talentRejection");
  const format = useFormatter();
  const profile = mine.profile ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-5 py-10 md:px-8">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {profile && <ReviewStatus state={profile.status}>{status(profile.status)}</ReviewStatus>}
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
      {profile?.status === "rejected" && (
        <Alert variant="destructive" className="max-w-3xl">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>
            {t("rejected.title", { reason: reason(profile.decisionReason ?? "other") })}
          </AlertTitle>
          <AlertDescription>
            {profile.decisionMessage && <p>{profile.decisionMessage}</p>}
            <p>{t("rejected.lead")}</p>
          </AlertDescription>
        </Alert>
      )}

      {mine.enquiries.length > 0 && (
        <section aria-labelledby="talent-enquiries" className="flex max-w-3xl flex-col gap-3">
          <h2 id="talent-enquiries" className="text-sm font-semibold">
            {t("enquiries", { count: mine.enquiries.length })}
          </h2>
          <ul className="overflow-hidden rounded-lg border">
            {mine.enquiries.map((enquiry) => (
              <li key={enquiry.id} className="flex flex-col gap-1 border-b p-4 last:border-b-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-sm font-medium">{enquiry.senderName}</span>
                  <time dateTime={enquiry.createdAt} className="text-xs text-muted-foreground">
                    {format.dateTime(new Date(enquiry.createdAt), { dateStyle: "medium" })}
                  </time>
                </div>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {enquiry.message}
                </p>
                <TextButton href={`mailto:${enquiry.senderEmail}`} size="sm" className="self-start">
                  {t("reply", { email: enquiry.senderEmail })}
                </TextButton>
              </li>
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
    </div>
  );
}

export { MyTalentPage };
