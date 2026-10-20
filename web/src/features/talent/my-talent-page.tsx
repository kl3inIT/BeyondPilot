import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { ReviewStatus, reviewState } from "@/components/composites/review-status";
import { useFormatter } from "@/i18n/format";
import { useVocabulary } from "@/i18n/vocabulary";
import type { MyTalent, TalentProfile } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { NoticeCard } from "@/features/organization/notice-card";
import { momentText } from "@/i18n/formats";

import { DeleteTalentProfile } from "./delete-talent-profile";
import { TalentCard } from "./talent-card";
import { talentSections } from "./talent-codes";
import { TalentForm } from "./talent-form";
import { TalentPreview } from "./talent-preview";
import { TalentView } from "./talent-view";

type MyTalentPageProps = {
  mine: MyTalent;
  /** The name of the caller's account, to start a new profile with. */
  accountName: string;
  /** True when the caller asked to edit a profile that is in review or approved. */
  editing: boolean;
};

/**
 * My talent profile, as the Figma frames "My talent profile — edit, draft saved" and "… approved,
 * listed in the directory" draw it, across the width of the page. A profile still being written,
 * sent back or taken down opens in the editor: the list of its sections, the form, and beside it
 * where the profile stands and how it shows in the directory. A profile in review or approved reads
 * as people see it, with where it stands, where what people write to it arrives and the way to
 * edit it beside it.
 */
function MyTalentPage({ mine, accountName, editing }: MyTalentPageProps) {
  const t = useTranslations("Talent.mine");
  const word = useVocabulary("talentStatus");
  const format = useFormatter();
  const profile = mine.profile ?? null;
  const settled =
    profile !== null &&
    (reviewState(profile) === "in_review" || reviewState(profile) === "approved");
  const reading = settled && !editing;
  const state = profile && [
    word(reviewState(profile)),
    t("saved", {
      when: momentText(format, new Date(profile.updatedAt)),
    }),
    // The decision card beside the profile says who sees a profile in review or approved.
    ...(profile.status === "approved" || profile.status === "in_review" ? [] : [t("seen.onlyYou")]),
  ];

  return (
    <div className="flex flex-1 flex-col bg-muted">
      <div className="mx-auto flex w-full max-w-360 flex-1 flex-col gap-6 px-5 pt-8 pb-16 md:px-8 md:pt-12 md:pb-24 xl:px-16 desktop:px-20">
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="text-3xl leading-none font-semibold tracking-title md:text-5xl md:leading-none">
              {t("title")}
            </h1>
            {settled && editing && (
              <TextButton href={siteRoutes.talentProfile}>{t("back")}</TextButton>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {state ? state.join(" · ") : t("leadNew")}
          </p>
        </div>

        {profile && reading ? (
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start xl:gap-8">
            <div className="min-w-0 flex-1">
              <TalentView profile={profile} />
            </div>
            <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24 lg:w-80 lg:shrink-0">
              <Decision profile={profile} />
              {profile.status === "approved" && (
                <p className="text-sm text-muted-foreground">
                  {t("messages.lead")}{" "}
                  <TextButton href={siteRoutes.messages}>{t("messages.open")}</TextButton>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Button prominence="secondary" href={`${siteRoutes.talentProfile}?edit=1`}>
                  {t("edit")}
                </Button>
                <DeleteTalentProfile />
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:gap-8">
            <SectionNav />
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              {/* The key gives a saved profile a fresh form, so it holds the new version. */}
              <TalentForm
                key={profile ? `${profile.version}-${profile.status}` : "new"}
                profile={profile}
                suggestedName={accountName}
                aside={
                  profile && (
                    <>
                      {reviewState(profile) !== "draft" && (
                        // On a narrow screen the decision comes before the form.
                        <div className="max-lg:-order-1">
                          <Decision profile={profile} />
                        </div>
                      )}
                      <PreviewCard profile={profile} />
                    </>
                  )
                }
              />
              {profile && (
                <div className="border-t pt-6">
                  <DeleteTalentProfile />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The sections of the form, to jump to; on a wide screen only, where it stays beside the form. */
function SectionNav() {
  const t = useTranslations("Talent");
  const sections = [
    [talentSections.profile, t("form.title")],
    [talentSections.basics, t("form.sections.basics")],
    [talentSections.skills, t("form.sections.skills")],
    [talentSections.projects, t("form.projects.title")],
    [talentSections.links, t("form.sections.links")],
    [talentSections.visibility, t("form.sections.visibility")],
  ] as const;

  return (
    <nav
      aria-label={t("mine.nav.label")}
      className="max-xl:hidden xl:sticky xl:top-24 xl:w-52 xl:shrink-0"
    >
      <ul className="flex flex-col gap-0.5">
        {sections.map(([id, label]) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The saved profile as its card in the directory shows it, without a link before it is public. */
function PreviewCard({ profile }: { profile: TalentProfile }) {
  const t = useTranslations("Talent.mine.previewCard");

  return (
    <section
      aria-labelledby="talent-preview-card"
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="talent-preview-card" className="text-sm font-semibold">
          {t("title")}
        </h2>
        <TalentPreview profile={profile} />
      </div>
      <TalentCard
        linked={false}
        person={{
          slug: profile.slug,
          name: profile.name,
          headline: profile.headline,
          photoFileId: profile.photoFileId,
          roles: profile.roles,
          skills: profile.skills,
          city: profile.city,
          country: profile.country,
          projectCount: profile.projects.length,
          leadProject: profile.projects[0] ?? null,
          // The owner's profile does not say whether GenAI Fund features it, so the preview never claims it.
          featured: false,
        }}
      />
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}

/**
 * What GenAI Fund decided, or that it is deciding, with its reason and what to do next. A draft has
 * nothing to say here: the line under the title already does.
 */
function Decision({ profile }: { profile: TalentProfile }) {
  const t = useTranslations("Talent.mine");
  const reason = useVocabulary("talentRejection");
  const format = useFormatter();
  const status = useVocabulary("talentStatus");
  const state = reviewState(profile);
  const badge = <ReviewStatus state={state}>{status(state)}</ReviewStatus>;

  if (state === "in_review") {
    return (
      <NoticeCard
        titleAs="h2"
        title={t("submitted.title")}
        description={<p>{t("submitted.lead")}</p>}
        badge={badge}
        foot={
          profile.submittedAt
            ? t("submitted.foot", {
                date: format.dateTime(new Date(profile.submittedAt), "date"),
              })
            : t("submitted.footUndated")
        }
      />
    );
  }
  if (state === "approved") {
    return (
      <NoticeCard
        titleAs="h2"
        title={t(profile.listed ? "approved.listed" : "approved.unlisted")}
        description={!profile.listed && <p>{t("approved.unlistedLead")}</p>}
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
  if (state === "suspended" || state === "needs_changes") {
    const takenDown = state === "suspended";
    const key = takenDown ? "takenDown" : "sentBack";
    const message = takenDown ? profile.suspensionMessage : profile.decisionMessage;
    return (
      <NoticeCard
        titleAs="h2"
        title={t(`${key}.title`, {
          reason: reason(
            (takenDown ? profile.suspensionReason : profile.decisionReason) ?? "other",
          ),
        })}
        description={message && <p className="whitespace-pre-line">{message}</p>}
        badge={badge}
        foot={t(`${key}.lead`)}
      />
    );
  }
  return null;
}

export { MyTalentPage };
