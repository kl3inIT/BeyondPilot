import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Status } from "@/components/composites/status";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVocabulary } from "@/i18n/vocabulary";
import type { MyTalent, TalentEnquiry, TalentProfile } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { NoticeCard } from "@/features/organization/notice-card";

import { DeleteTalentProfile } from "./delete-talent-profile";
import { TalentEnquiryActions } from "./talent-enquiry-actions";
import { TalentForm } from "./talent-form";
import { TalentPreview } from "./talent-preview";
import { TalentStatus } from "./talent-status";

type MyTalentPageProps = {
  mine: MyTalent;
  /** The name of the caller's account, to start a new profile with. */
  accountName: string;
};

/**
 * My talent profile, as the Figma frame "My talent profile — edit, draft saved" draws it: the title
 * with where the profile stands and when it was saved, a preview of the saved page, the decision of
 * GenAI Fund when there is one, then two tabs: the editor and the enquiries people sent through it.
 * A person without a profile sees the same editor, empty.
 */
function MyTalentPage({ mine, accountName }: MyTalentPageProps) {
  const t = useTranslations("Talent.mine");
  const word = useVocabulary("talentStatus");
  const format = useFormatter();
  const profile = mine.profile ?? null;
  const waiting = mine.enquiries.filter((enquiry) => enquiry.status === "pending").length;
  const state = profile && [
    word(profile.status),
    t("saved", {
      when: format.dateTime(new Date(profile.updatedAt), {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    }),
    t(`seen.${seenBy(profile)}`),
  ];

  return (
    <div className="flex flex-1 justify-center bg-muted px-5 pt-10 pb-16 md:px-8 md:pt-14 md:pb-24 lg:px-16">
      <div className="flex w-full max-w-220 flex-col gap-6">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl leading-none font-semibold tracking-title md:text-5xl md:leading-none">
              {t("title")}
            </h1>
            {profile && <TalentPreview profile={profile} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {state ? state.join(" · ") : t("leadNew")}
          </p>
        </div>

        {profile && <Decision profile={profile} />}

        <Tabs defaultValue="profile">
          <TabsList variant="underline" aria-label={t("tabs.label")}>
            <TabsTrigger value="profile">{t("tabs.profile")}</TabsTrigger>
            <TabsTrigger value="enquiries">
              {t("tabs.enquiries")}
              <span className="text-xs font-medium in-data-active:text-primary">
                {mine.enquiries.length}
              </span>
            </TabsTrigger>
          </TabsList>
          {/* Kept mounted, so unsaved changes survive a look at the enquiries. */}
          <TabsContent value="profile" keepMounted>
            <div className="mt-4 flex flex-col gap-6">
              {/* The key gives a saved profile a fresh form, so it holds the new version. */}
              <TalentForm
                key={profile ? `${profile.version}-${profile.status}` : "new"}
                profile={profile}
                suggestedName={accountName}
              />
              {profile && <DeleteTalentProfile />}
            </div>
          </TabsContent>
          <TabsContent value="enquiries">
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">
                  {t("inbox.title")}
                  {waiting > 0 && (
                    <span className="ml-2 text-sm font-medium text-primary">
                      {t("inbox.waiting", { count: waiting })}
                    </span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground">{t("inbox.lead")}</p>
              </div>
              {mine.enquiries.length > 0 ? (
                <ul className="overflow-hidden rounded-2xl border bg-card">
                  {mine.enquiries.map((enquiry) => (
                    <EnquiryItem key={enquiry.id} enquiry={enquiry} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
                  {t("inbox.none")}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/** Who can open the profile now, which the line under the title says after its status. */
function seenBy(profile: TalentProfile) {
  if (profile.status === "approved") {
    return profile.listed ? "listed" : "hidden";
  }
  return profile.status === "submitted" ? "inReview" : "onlyYou";
}

/**
 * What GenAI Fund decided, or that it is deciding, with its reason and what to do next. A draft has
 * nothing to say here: the line under the title already does.
 */
function Decision({ profile }: { profile: TalentProfile }) {
  const t = useTranslations("Talent.mine");
  const reason = useVocabulary("talentRejection");
  const format = useFormatter();
  const badge = <TalentStatus status={profile.status} />;

  if (profile.status === "submitted") {
    return (
      <NoticeCard
        titleAs="h2"
        title={t("submitted.title")}
        description={<p>{t("submitted.lead")}</p>}
        badge={badge}
        foot={
          profile.submittedAt
            ? t("submitted.foot", {
                date: format.dateTime(new Date(profile.submittedAt), { dateStyle: "medium" }),
              })
            : t("submitted.footUndated")
        }
      />
    );
  }
  if (profile.status === "approved") {
    return (
      <NoticeCard
        titleAs="h2"
        title={t(profile.listed ? "approved.listed" : "approved.unlisted")}
        description={<p>{t(profile.listed ? "approved.listedLead" : "approved.unlistedLead")}</p>}
        badge={badge}
        foot={t("approved.foot")}
        actions={
          profile.listed && (
            <Button prominence="secondary" href={`${siteRoutes.talent}/${profile.slug}`}>
              {t("approved.open")}
            </Button>
          )
        }
      />
    );
  }
  if (profile.status === "changes_requested" || profile.status === "removed") {
    const key = profile.status === "removed" ? "removed" : "changesRequested";
    return (
      <NoticeCard
        titleAs="h2"
        title={t(`${key}.title`, { reason: reason(profile.decisionReason ?? "other") })}
        description={
          profile.decisionMessage && (
            <p className="whitespace-pre-line">{profile.decisionMessage}</p>
          )
        }
        badge={badge}
        foot={t(`${key}.lead`)}
      />
    );
  }
  return null;
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
    <li className="flex flex-col gap-3 p-5 not-last:border-b">
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
