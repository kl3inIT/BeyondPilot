import { cn } from "cn";
import { ArrowRightIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { Button } from "@/components/actions/button";
import { Glow } from "@/components/ui/glow";
import { Section } from "@/components/ui/section";
import { getPathname } from "@/i18n/navigation";
import { liveCampaignUrl, siteRoutes } from "@/lib/site";

const rise =
  "animate-in ease-entrance animation-duration-800 fill-mode-both fade-in slide-in-from-bottom-4 motion-reduce:animate-none";

/**
 * The agent's promise, one search and a real screenshot of the product, on the aurora (Figma
 * "Landing / 1440"). Text rises in on load, one line after another; the heading rises without
 * fading, because a browser skips an invisible element when it measures the largest paint, and
 * the heading is that paint.
 */
function Hero() {
  const t = useTranslations("Home.hero");
  const s = useTranslations("Site");
  const locale = useLocale();

  return (
    <Section className="overflow-x-clip">
      <Glow />
      <div className="relative flex flex-col gap-12 pt-10 lg:flex-row lg:justify-between lg:gap-10 lg:pt-13">
        <div className="flex flex-col items-start lg:w-150 lg:shrink-0">
          <a
            href={liveCampaignUrl}
            className={cn(
              rise,
              "hit-area flex h-8 max-w-full items-center gap-2 rounded-full border bg-card px-4 text-caption font-medium delay-100 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
            )}
          >
            <span className="truncate">{t("liveChallenge")}</span>
            <ArrowRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
          </a>
          <p className={cn(rise, "mt-8 text-base font-medium text-primary delay-140")}>
            {t("eyebrow")}
          </p>
          <h1 className="mt-4.5 animate-in text-5xl font-semibold delay-180 ease-entrance animation-duration-800 fill-mode-both slide-in-from-bottom-4 motion-reduce:animate-none lg:text-display lg:tracking-display">
            {t("titleStart")}{" "}
            <span className="block bg-linear-to-r from-primary to-lilac-foreground bg-clip-text text-transparent">
              {t("titleEnd")}
            </span>
          </h1>
          <p
            className={cn(
              rise,
              "mt-8 max-w-140 text-base text-muted-foreground delay-260 lg:text-lg",
            )}
          >
            {t("description")}
          </p>
          <form
            role="search"
            action={getPathname({ href: siteRoutes.search, locale })}
            className={cn(
              rise,
              "mt-4 flex h-16 w-full max-w-150 items-center rounded-full bg-card px-8 shadow-search delay-340 focus-within:ring-3 focus-within:ring-ring/50",
            )}
          >
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
          </form>
          <div className={cn(rise, "mt-11.5 flex flex-col gap-4 delay-420 sm:flex-row")}>
            <Button size="2xl" prominence="inverse" href={siteRoutes.solutions}>
              {t("primaryCta")}
            </Button>
            <Button size="2xl" prominence="secondary" href={siteRoutes.howItWorks}>
              {t("secondaryCta")}
            </Button>
          </div>
          <p
            className={cn(
              rise,
              "mt-8 flex items-center gap-2 text-sm text-muted-foreground delay-500",
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
        <div
          className={cn(
            rise,
            "overflow-hidden rounded-3xl border border-card bg-card shadow-float delay-340 lg:mt-13 lg:w-140 lg:shrink-0 lg:self-start",
          )}
        >
          <Image
            src="/landing/product-search.png"
            alt={t("screenshotAlt")}
            width={900}
            height={840}
            sizes="(min-width: 1024px) 35rem, 100vw"
            priority
            className="hidden h-auto w-full md:block"
          />
          <Image
            src="/landing/product-search-mobile.png"
            alt={t("screenshotAlt")}
            width={535}
            height={1042}
            sizes="100vw"
            priority
            className="h-auto w-full md:hidden"
          />
        </div>
      </div>
    </Section>
  );
}

export { Hero };
