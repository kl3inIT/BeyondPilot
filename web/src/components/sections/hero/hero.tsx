import { cn } from "cn";
import { SearchIcon, SparklesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/actions/button";
import { SearchPreview } from "@/components/sections/hero/search-preview";
import { Glow } from "@/components/ui/glow";
import { Section } from "@/components/ui/section";
import { getPathname, Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

const rise =
  "animate-in ease-entrance animation-duration-800 fill-mode-both fade-in slide-in-from-bottom-4 motion-reduce:animate-none";

const prompts = ["claims", "talent", "projects", "programs"] as const;

/**
 * The agent's promise, one search with example prompts and a preview of what it returns, on the
 * aurora (Figma "Landing v2 / Hero"). Text rises in on load, one line after another; the heading
 * rises without fading, because a browser skips an invisible element when it measures the largest
 * paint, and the heading is that paint.
 */
function Hero() {
  const t = useTranslations("Home.hero");
  const s = useTranslations("Site");
  const locale = useLocale();

  return (
    <Section className="overflow-x-clip">
      <Glow />
      <div className="relative flex flex-col gap-12 pt-10 pb-4 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:pt-16">
        <div className="flex min-w-0 flex-col items-start lg:w-150 lg:shrink-0">
          <p
            className={cn(
              rise,
              "flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-semibold text-primary delay-100",
            )}
          >
            <SparklesIcon className="size-3.5" aria-hidden="true" />
            {t("eyebrow")}
          </p>
          <h1 className="mt-5 animate-in text-5xl font-semibold delay-180 ease-entrance animation-duration-800 fill-mode-both slide-in-from-bottom-4 motion-reduce:animate-none lg:text-display lg:tracking-display">
            {t("titleStart")} {t("titleEnd")}
          </h1>
          <p
            className={cn(
              rise,
              "mt-6 max-w-140 text-base text-muted-foreground delay-260 lg:text-lg",
            )}
          >
            {t("description")}
          </p>
          <form
            role="search"
            action={getPathname({ href: siteRoutes.search, locale })}
            className={cn(
              rise,
              "mt-6 flex h-16 w-full max-w-150 items-center gap-3 rounded-full bg-card pr-2.5 pl-6 shadow-search delay-340 focus-within:ring-3 focus-within:ring-ring/50",
            )}
          >
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="hero-search" className="sr-only">
              {t("searchLabel")}
            </label>
            <div className="relative min-w-0 flex-1">
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
              {t("searchSubmit")}
            </Button>
          </form>
          <ul
            aria-label={t("promptsLabel")}
            className={cn(rise, "mt-4 flex max-w-150 flex-wrap gap-2 delay-380")}
          >
            {prompts.map((prompt) => (
              <li
                key={prompt}
                className={cn(prompt !== "claims" && prompt !== "talent" && "hidden md:block")}
              >
                <Link
                  href={{ pathname: siteRoutes.search, query: { q: t(`prompts.${prompt}`) } }}
                  className="hit-area flex items-center rounded-full border bg-card px-3 py-1 text-xs font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {t(`prompts.${prompt}`)}
                </Link>
              </li>
            ))}
          </ul>
          <div
            className={cn(rise, "mt-8 flex w-full flex-col gap-3 delay-420 sm:w-auto sm:flex-row")}
          >
            <Button size="2xl" href={siteRoutes.solutions}>
              {t("primaryCta")}
            </Button>
            <Button size="2xl" prominence="secondary" href={siteRoutes.howItWorks}>
              {t("secondaryCta")}
            </Button>
          </div>
          <p
            className={cn(
              rise,
              "mt-6 flex items-center gap-2 text-sm text-muted-foreground delay-500",
            )}
          >
            {s("backedBy")}
            <Image
              src="/brand/genaifund-logo.png"
              alt={s("genaiFund")}
              width={1200}
              height={252}
              className="h-5.25 w-auto dark:hidden"
            />
            <Image
              src="/brand/genaifund-logo-white.png"
              alt={s("genaiFund")}
              width={1200}
              height={254}
              className="hidden h-5.25 w-auto dark:block"
            />
          </p>
        </div>
        <SearchPreview className={cn(rise, "delay-340 lg:w-140 lg:shrink-0")} />
      </div>
    </Section>
  );
}

export { Hero };
