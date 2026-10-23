import { getTranslations } from "next-intl/server";

import { PerkCard } from "./perk-card";
import { readProgramPerks } from "./perk-queries";

/**
 * The Perks section of a program's page: the perks for its applicants or its shortlist, and those an
 * operator added there, each saying whether the reader's team may get it yet. Nothing when it has
 * none.
 */
async function ProgramPerks({ slug }: { slug: string }) {
  const [t, perks] = await Promise.all([getTranslations("Perk.program"), readProgramPerks(slug)]);
  if (perks.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-title">{t("title")}</h2>
        <p className="text-muted-foreground">{t("lead")}</p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {perks.map((perk) => (
          <li key={perk.id} className="flex min-w-0">
            <PerkCard perk={perk} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export { ProgramPerks };
