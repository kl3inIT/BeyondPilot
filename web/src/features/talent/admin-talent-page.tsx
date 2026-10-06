import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { QueueNext } from "@/components/composites/queue-next";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminTalent } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentReview } from "./talent-review";
import { TalentStatus } from "./talent-status";
import { TalentView } from "./talent-view";

type AdminTalentPageProps = {
  detail: AdminTalent;
  /** The next record that waits for a decision, if another does. */
  next: { href: string; name: string } | null;
  /** Where this record stands among those that wait, and how many do. */
  queue: { place: number | null; total: number };
};

/** Admin › Talent › one profile: what the person wrote, whose account it is, and the decision. */
function AdminTalentPage({ detail, next, queue }: AdminTalentPageProps) {
  const t = useTranslations("Admin.talent.detail");
  const reason = useVocabulary("talentRejection");
  const countryName = useCountryName();
  const format = useFormatter();
  const locale = useLocale();
  const { profile } = detail;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <TextButton href={siteRoutes.adminTalent}>
          <ArrowLeftIcon aria-hidden="true" />
          {t("back")}
        </TextButton>
        <QueueNext
          position={
            queue.place === null
              ? undefined
              : t("position", { place: queue.place, total: queue.total })
          }
          next={next && { href: next.href, label: t("next", { name: next.name }) }}
        />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          {profile.headline && <p className="text-muted-foreground">{profile.headline}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <TalentStatus status={profile.status} />
            <span>{detail.email}</span>
            {profile.country && <span>{countryName(profile.country)}</span>}
            {profile.submittedAt && (
              <span>
                {profile.status === "submitted"
                  ? t("waitingSince", { time: format.relativeTime(new Date(profile.submittedAt)) })
                  : t("submitted", {
                      day: format.dateTime(new Date(profile.submittedAt), { dateStyle: "medium" }),
                    })}
              </span>
            )}
            {!profile.listed && <span>{t("unlisted")}</span>}
            {profile.status === "approved" && profile.listed && (
              <TextButton href={`${siteRoutes.talent}/${profile.slug}`}>{t("public")}</TextButton>
            )}
          </div>
        </div>
        {(profile.status === "submitted" || profile.status === "approved") && (
          <TalentReview
            key={profile.id}
            profile={profile}
            nextHref={next?.href ?? `${siteRoutes.adminTalent}?status=submitted`}
          />
        )}
      </div>

      {(profile.status === "changes_requested" || profile.status === "removed") && (
        <p className="rounded-lg border bg-muted p-3 text-sm">
          <span className="font-medium">
            {t(profile.status === "removed" ? "removed" : "rejected", {
              reason: reason(profile.decisionReason ?? "other"),
            })}
          </span>
          {profile.decisionMessage && <> {profile.decisionMessage}</>}
        </p>
      )}

      <TalentView profile={profile} />
    </div>
  );
}

export { AdminTalentPage };
