import { ArrowLeftIcon } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { QueueNext } from "@/components/composites/queue-next";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { AdminTalent } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { TalentReview } from "./talent-review";
import { TalentView } from "./talent-view";

type AdminTalentPageProps = {
  detail: AdminTalent;
  /** The next record that waits for a decision, if another does. */
  next: { href: string; name: string } | null;
  /** Where this record stands among those that wait, and how many do. */
  queue: { place: number | null; total: number };
};

/**
 * Admin › Talent › one profile, as the Figma frame "Admin — AI talent, review one profile" draws it:
 * who the person is, then what they wrote, with the decision in a card beside it that stays in view.
 */
function AdminTalentPage({ detail, next, queue }: AdminTalentPageProps) {
  const t = useTranslations("Admin.talent.detail");
  const reason = useVocabulary("talentRejection");
  const status = useVocabulary("talentStatus");
  const role = useVocabulary("talentRole");
  const countryName = useCountryName();
  const format = useFormatter();
  const locale = useLocale();
  const { profile } = detail;
  const who = [
    profile.roles.length > 0 && role(profile.roles[0]),
    [profile.city, profile.country && countryName(profile.country)].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const state = reviewState(profile);
  const sent =
    profile.submittedAt &&
    (profile.status === "in_review"
      ? t("waitingSince", { time: format.relativeTime(new Date(profile.submittedAt)) })
      : t("submitted", {
          day: format.dateTime(new Date(profile.submittedAt), { dateStyle: "medium" }),
        }));

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

      <div className="flex w-full flex-col gap-8">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          {profile.headline && <p className="text-muted-foreground">{profile.headline}</p>}
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {who && <span>{who}</span>}
            <span>{detail.email}</span>
          </p>
        </header>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start xl:gap-8">
          <div className="min-w-0 flex-1 max-lg:order-1">
            <TalentView profile={profile} />
          </div>
          <section
            aria-labelledby="talent-decision"
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:sticky lg:top-6 lg:w-88 lg:shrink-0"
          >
            <div className="flex flex-col-reverse items-start gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 id="talent-decision" className="text-lg font-semibold">
                  {t(`decision.${state}.title`)}
                </h2>
                {/* A profile sent back or taken down says why in the note below. */}
                {state !== "needs_changes" && state !== "suspended" && (
                  <p className="text-sm text-muted-foreground">{t(`decision.${state}.lead`)}</p>
                )}
              </div>
              <ReviewStatus state={state}>{status(state)}</ReviewStatus>
            </div>
            {profile.suspendedAt ? (
              <p className="rounded-lg bg-muted p-3 text-sm">
                <span className="font-medium">
                  {t("takenDown", { reason: reason(profile.suspensionReason ?? "other") })}
                </span>
                {profile.suspensionMessage && <> {profile.suspensionMessage}</>}
              </p>
            ) : (
              profile.status === "needs_changes" && (
                <p className="rounded-lg bg-muted p-3 text-sm">
                  <span className="font-medium">
                    {t("sentBack", { reason: reason(profile.decisionReason ?? "other") })}
                  </span>
                  {profile.decisionMessage && <> {profile.decisionMessage}</>}
                </p>
              )
            )}
            <div className="flex flex-col items-start gap-3 border-t pt-4">
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {sent && <span>{sent}</span>}
                {!profile.listed && <span className="text-muted-foreground">{t("unlisted")}</span>}
                {state === "approved" && profile.listed && (
                  <TextButton href={`${siteRoutes.talent}/${profile.slug}`}>
                    {t("public")}
                  </TextButton>
                )}
              </p>
              {(state === "in_review" || state === "approved" || state === "suspended") && (
                <TalentReview
                  key={profile.id}
                  profile={profile}
                  nextHref={next?.href ?? `${siteRoutes.adminTalent}?status=in_review`}
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export { AdminTalentPage };
