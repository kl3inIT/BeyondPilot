"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** How many skills a card names before it counts the rest: two, and one on a phone. */
const SHOWN = 2;

/**
 * The skills on a card of the directory: the first ones by name and the rest as a count that opens
 * the whole list, on hover and on a press.
 */
function TalentSkills({ skills }: { skills: string[] }) {
  const t = useTranslations("Talent.directory");

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {skills.slice(0, SHOWN).map((skill, index) => (
        <li key={skill} className={index > 0 ? "max-md:hidden" : undefined}>
          <Badge variant="secondary">{skill}</Badge>
        </li>
      ))}
      {skills.length > 1 && (
        <li className={skills.length <= SHOWN ? "md:hidden" : undefined}>
          <Popover>
            <PopoverTrigger
              openOnHover
              aria-label={t("allSkills", { count: skills.length })}
              render={
                <Badge
                  variant="secondary"
                  className="relative z-10"
                  render={<button type="button" />}
                />
              }
            >
              <span className="md:hidden">{t("more", { count: skills.length - 1 })}</span>
              <span className="max-md:hidden">{t("more", { count: skills.length - SHOWN })}</span>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={8} className="w-75">
              <ul className="flex flex-wrap gap-1.5">
                {skills.map((skill) => (
                  <li key={skill}>
                    <Badge variant="secondary">{skill}</Badge>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </li>
      )}
    </ul>
  );
}

export { TalentSkills };
