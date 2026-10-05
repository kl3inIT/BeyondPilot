import { Link } from "@/i18n/navigation";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalentSummary } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { siteRoutes } from "@/lib/site";

import { TalentSkills } from "./talent-skills";

/**
 * One person in the directory. The whole card leads to the profile through the name's link; the
 * count of further skills sits above it and opens the full list. The profile has no photo, so the
 * photo's place holds the person's initials.
 */
function TalentCard({ person }: { person: PublicTalentSummary }) {
  const role = useVocabulary("talentRole");
  const countryName = useCountryName();
  const kind = [
    person.roles.length > 0 && role(person.roles[0]),
    person.country && countryName(person.country),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="relative flex flex-1 gap-4 rounded-2xl border bg-card p-5 transition-colors hover:border-ring has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50">
      {/* No photo is held yet, so the mark is the person's initials, sized as a mark and not as the photo the frame draws. */}
      <div
        aria-hidden="true"
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-primary md:size-14 md:text-base"
      >
        {initials(person.name, person.name)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="truncate font-medium">
            <Link
              href={`${siteRoutes.talent}/${person.slug}`}
              className="outline-none after:absolute after:inset-0 after:rounded-2xl"
            >
              {person.name}
            </Link>
          </h2>
          {kind && <p className="truncate text-xs font-medium text-muted-foreground">{kind}</p>}
        </div>
        {person.headline && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{person.headline}</p>
        )}
        {person.skills.length > 0 && <TalentSkills skills={person.skills} />}
      </div>
    </article>
  );
}

export { TalentCard };
