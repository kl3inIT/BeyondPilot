import { ArrowRightIcon, SearchIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import {
  FloatingCards,
  FloatingCardsStack,
  type HeroCardsData,
} from "@/components/sections/hero/floating-cards";
import { Badge } from "@/components/ui/badge";
import { Glow } from "@/components/ui/glow";
import { Section } from "@/components/ui/section";
import { getPathname, Link } from "@/i18n/navigation";
import { liveCampaignUrl, siteRoutes } from "@/lib/site";

const scopes = ["agentic", "document", "insurance", "retail"] as const;

/**
 * One question and one search on Cool Paper, with the sky light behind it and real cards around it
 * (DESIGN.md › Landing structure). Text rises in on load, one line after another; the heading
 * rises without fading, because a browser skips an invisible element when it measures the largest
 * paint, and the heading is that paint.
 */
function Hero({ cards }: { cards: HeroCardsData }) {
  const t = useTranslations("Home.hero");
  const c = useTranslations("Campaign");
  const locale = useLocale();

  return (
    <Section surface="muted" className="overflow-hidden">
      <Glow />
      <FloatingCards cards={cards} />
      <div className="relative flex flex-col items-center gap-2 pt-12 pb-6 lg:h-205 lg:pt-44 lg:pb-0">
        <div className="@container flex w-full max-w-190 flex-col items-center gap-6 text-center">
          <a
            href={liveCampaignUrl}
            className="hit-area flex h-11 max-w-full animate-in items-center gap-2 rounded-full border py-1 pr-3 pl-2 text-sm delay-100 ease-entrance animation-duration-800 fill-mode-both outline-none fade-in slide-in-from-bottom-4 hover:bg-background/60 focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:animate-none md:h-auto md:gap-2.5 md:pr-3.5 md:pl-1"
          >
            <Badge variant="success">{c("live")}</Badge>
            <span className="font-medium whitespace-nowrap">
              <span className="md:hidden">{c("shortName")}</span>
              <span className="hidden md:inline">{c("name")}</span>
            </span>
            <span className="min-w-0 truncate text-muted-foreground @max-chip:hidden">
              <span className="md:hidden">{c("closesShort")}</span>
              <span className="hidden md:inline">{c("submissionsClose")}</span>
            </span>
            <span className="flex items-center gap-1 font-semibold whitespace-nowrap">
              {c("apply")}
              <ArrowRightIcon className="size-3.5" aria-hidden="true" />
            </span>
          </a>
          <h1 className="animate-in text-4xl font-semibold text-balance delay-180 ease-entrance animation-duration-800 fill-mode-both slide-in-from-bottom-4 motion-reduce:animate-none lg:text-7xl lg:tracking-display">
            {t("title")}
          </h1>
          <p className="max-w-145 animate-in text-base font-medium text-muted-foreground delay-260 ease-entrance animation-duration-800 fill-mode-both fade-in slide-in-from-bottom-4 motion-reduce:animate-none lg:text-xl">
            {t("description")}
          </p>
          <form
            role="search"
            action={getPathname({ href: siteRoutes.search, locale })}
            className="flex w-full max-w-160 animate-in items-center gap-3 rounded-full border bg-card py-2 pr-2 pl-6 shadow-search delay-340 ease-entrance animation-duration-800 fill-mode-both fade-in slide-in-from-bottom-4 focus-within:ring-3 focus-within:ring-ring/50 motion-reduce:animate-none"
          >
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="relative min-w-0 flex-1">
              <label htmlFor="hero-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <input
                id="hero-search"
                name="q"
                type="search"
                placeholder=" "
                className="peer w-full bg-transparent text-base text-foreground outline-none"
              />
              {/* The placeholder shortens on phones, which the attribute cannot do. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 hidden truncate text-left text-base text-muted-foreground peer-placeholder-shown:block"
              >
                <span className="md:hidden">{t("searchPlaceholderShort")}</span>
                <span className="hidden md:inline">{t("searchPlaceholder")}</span>
              </span>
            </div>
            <Button type="submit" size="lg">
              {t("search")}
            </Button>
          </form>
          <ul
            aria-label={t("scopesLabel")}
            className="flex animate-in flex-wrap justify-center gap-2 delay-420 ease-entrance animation-duration-800 fill-mode-both fade-in slide-in-from-bottom-4 motion-reduce:animate-none"
          >
            {scopes.map((scope) => (
              <li key={scope} className="flex">
                <Badge
                  variant="outline"
                  render={
                    <Link
                      href={{ pathname: siteRoutes.search, query: { q: t(`scopes.${scope}`) } }}
                    />
                  }
                  className="hit-area"
                >
                  {t(`scopes.${scope}`)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        <FloatingCardsStack cards={cards} />
      </div>
    </Section>
  );
}

export { Hero };
