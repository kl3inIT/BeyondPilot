import { cn } from "cn";
import {
  ArrowRightIcon,
  BlocksIcon,
  BriefcaseBusinessIcon,
  CalendarDaysIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

/** `shows` is what the card lists under its description: listings, event dates or skills. */
const categories = [
  {
    id: "solutions",
    href: siteRoutes.solutions,
    Icon: BlocksIcon,
    ink: "text-solution",
    shows: "items",
  },
  { id: "talent", href: siteRoutes.talent, Icon: UsersIcon, ink: "text-talent", shows: "skills" },
  {
    id: "useCases",
    href: siteRoutes.useCases,
    Icon: BriefcaseBusinessIcon,
    ink: "text-use-case",
    shows: "items",
  },
  {
    id: "events",
    href: `${siteRoutes.programs}?type=event`,
    Icon: CalendarDaysIcon,
    ink: "text-primary",
    shows: "dates",
  },
  {
    id: "programs",
    href: siteRoutes.programs,
    Icon: TrophyIcon,
    ink: "text-primary",
    shows: "items",
  },
] as const;

const rows = [1, 2] as const;
const skills = [1, 2, 3, 4] as const;

/**
 * Five ways into the product's directories and the program list, three cards over two (Figma
 * "Landing v2 / Explore"). Each card names what is listed there rather than showing a stock photo.
 */
function Categories() {
  const t = useTranslations("Home.categories");

  return (
    <Section>
      <div className="flex flex-col pb-16 lg:pb-25">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-headline lg:text-section lg:tracking-section">
          {t("title")}
        </h2>
        <ul className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-6 lg:gap-5">
          {categories.map(({ id, href, Icon, ink, shows }, index) => (
            <li
              key={id}
              className={cn(
                "flex min-w-0",
                index < 3 ? "lg:col-span-2" : "lg:col-span-3",
                index === 4 && "md:col-span-2",
              )}
            >
              <article className="flex w-full flex-col rounded-2xl border bg-card p-6">
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-lg bg-accent",
                    ink,
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-xl font-semibold">{t(`${id}.title`)}</h3>
                <p className="mt-2 text-copy text-muted-foreground">{t(`${id}.description`)}</p>
                {shows === "items" && (
                  <ul className="mt-5 divide-y border-t">
                    {rows.map((row) => (
                      <li key={row} className="flex flex-col gap-0.5 py-3">
                        <span className="truncate text-sm font-medium">
                          {t(`${id}.item${row}Title`)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t(`${id}.item${row}Meta`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {shows === "dates" && (
                  <ul className="mt-5 divide-y border-t">
                    {rows.map((row) => (
                      <li key={row} className="flex items-center gap-3 py-3">
                        <span className="flex h-11 w-10 shrink-0 flex-col items-center justify-center rounded-lg border bg-card">
                          <span className="text-xs leading-none font-semibold text-primary uppercase">
                            {t(`${id}.item${row}Month`)}
                          </span>
                          <span className="text-copy leading-none font-medium">
                            {t(`${id}.item${row}Day`)}
                          </span>
                        </span>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate text-sm font-medium">
                            {t(`${id}.item${row}Title`)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t(`${id}.item${row}Meta`)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {shows === "skills" && (
                  <ul aria-label={t(`${id}.skillsLabel`)} className="mt-5 flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <li
                        key={skill}
                        className="rounded-full border bg-card px-2.5 py-1 text-xs font-medium"
                      >
                        {t(`${id}.skill${skill}`)}
                      </li>
                    ))}
                  </ul>
                )}
                <TextButton href={href} className="mt-auto self-start pt-6 font-normal">
                  {t(`${id}.action`)}
                  <ArrowRightIcon aria-hidden="true" />
                </TextButton>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Categories };
