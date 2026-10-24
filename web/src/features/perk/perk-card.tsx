import { BadgeCheckIcon, CalendarIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Status } from "@/components/composites/status";
import { OrganizationMark } from "@/features/organization/organization-mark";
import { useFormatter } from "@/i18n/format";
import { Link } from "@/i18n/navigation";
import type { PerkCard as PerkCardData } from "@/lib/api/generated";
import { siteRoutes } from "@/lib/site";

import { PerkAudience } from "./perk-audience";

/**
 * What a card says of where the caller's team stands: what it holds, or why nobody gets the perk now.
 * Who the perk is for is said by its audience line, so a card names nothing when the team may get it
 * or is outside the audience.
 */
function CardStanding({ perk }: { perk: PerkCardData }) {
  const t = useTranslations("Perk.standing");

  if (perk.standing === "claimed" && perk.claimState) {
    const tone =
      perk.claimState === "declined"
        ? "destructive"
        : perk.claimState === "waiting"
          ? "warning"
          : "success";
    return (
      <Status tone={tone} appearance="pill">
        {t(`claim.${perk.claimState}`)}
      </Status>
    );
  }
  if (perk.standing === "ended" || perk.standing === "full" || perk.standing === "not_started") {
    return <Status appearance="pill">{t(perk.standing)}</Status>;
  }
  return null;
}

/**
 * One perk of the catalogue or of a program's page: who gives it, the figure it is worth, what it is,
 * who may get it and until when, and what the caller's team holds of it. The whole card opens the
 * perk's page.
 */
function PerkCard({ perk }: { perk: PerkCardData }) {
  const t = useTranslations("Perk.card");
  const format = useFormatter();

  return (
    <article className="relative flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border bg-card p-5 wrap-anywhere transition-colors hover:border-ring has-[h2>a:focus-visible]:border-ring has-[h2>a:focus-visible]:ring-3 has-[h2>a:focus-visible]:ring-ring/50">
      <div className="flex min-w-0 items-center gap-2.5">
        <OrganizationMark
          name={perk.organizationName}
          logoFileId={perk.organizationLogoFileId}
          size="wide"
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{perk.organizationName}</span>
        {perk.fromGenAiFund && (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
            <BadgeCheckIcon className="size-4" aria-hidden="true" />
            {t("fromGenAiFund")}
          </span>
        )}
      </div>
      {perk.value && (
        <p className="text-2xl leading-tight font-semibold tracking-title">{perk.value}</p>
      )}
      <h2 className="text-base font-medium">
        <Link
          href={`${siteRoutes.perks}/${perk.slug}`}
          className="outline-none after:absolute after:inset-0 after:rounded-2xl"
        >
          {perk.title}
        </Link>
      </h2>
      {perk.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{perk.summary}</p>}
      <div className="mt-auto flex flex-col gap-1.5 pt-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <UsersIcon className="size-4 shrink-0" aria-hidden="true" />
          <PerkAudience audience={perk.audience} programName={perk.programName} />
        </p>
        {perk.endsAt && (
          <p className="flex items-center gap-1.5">
            <CalendarIcon className="size-4 shrink-0" aria-hidden="true" />
            {t(perk.ended ? "ended" : "until", {
              date: format.dateTime(new Date(perk.endsAt), "date"),
            })}
          </p>
        )}
      </div>
      <div className="flex min-h-6 items-center gap-2 empty:hidden">
        <CardStanding perk={perk} />
      </div>
    </article>
  );
}

export { PerkCard };
