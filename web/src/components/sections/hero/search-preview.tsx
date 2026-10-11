import { cn } from "cn";
import { LockIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { PreviewBadge } from "@/components/sections/preview-badge";

const tabs = ["all", "solutions", "useCases", "programs"] as const;

/**
 * Listings a search for "AI agents" returns, one of each kind the site lists for it, each with the
 * logo of who is behind it. `ink` marks a logo on transparent that turns to one light ink at night.
 */
const results = [
  { id: "revve", kind: "solution", logo: "/landing/logo-revve.jpeg", ink: false },
  { id: "shieldbase", kind: "solution", logo: "/landing/logo-shieldbase.png", ink: false },
  { id: "claims", kind: "useCase", logo: "/partners/network/coca-cola.png", ink: true },
  { id: "fasttrack", kind: "program", logo: "/landing/logo-nvidia.png", ink: true },
] as const;

const kindInk = {
  solution: "text-solution",
  useCase: "text-use-case",
  program: "text-primary",
} as const;

/**
 * What a search returns, drawn in the page rather than shown as a screenshot so it stays legible
 * at every width (Figma "Landing v2 / ProductPreview"). It is one image to assistive technology,
 * described by its label, and it says it is a preview.
 */
function SearchPreview({ className }: { className?: string }) {
  const t = useTranslations("Home.hero.preview");
  const h = useTranslations("Home");

  return (
    <div
      role="img"
      aria-label={t("alt")}
      className={cn("overflow-hidden rounded-3xl border bg-card shadow-float", className)}
    >
      <div aria-hidden="true">
        <div className="flex items-center gap-3 border-b bg-muted px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-input" />
            <span className="size-2.5 rounded-full bg-input" />
            <span className="size-2.5 rounded-full bg-input" />
          </div>
          <p className="flex min-w-0 flex-1 items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
            <LockIcon className="size-3 shrink-0" />
            <span className="truncate">{t("address")}</span>
          </p>
          <PreviewBadge>{h("previewLabel")}</PreviewBadge>
        </div>
        <ul className="flex gap-5 border-b px-4 pt-3.5 text-sm font-medium md:px-5">
          {tabs.map((tab, index) => (
            <li
              key={tab}
              className={cn(
                "border-b-2 pb-3",
                index === 0
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground",
                tab === "programs" && "hidden sm:block",
              )}
            >
              {t(`tabs.${tab}`)}
            </li>
          ))}
        </ul>
        <ul className="divide-y">
          {results.map(({ id, kind, logo, ink }) => (
            <li key={id} className="flex gap-4 px-4 py-4 md:px-5">
              <span className="relative size-10 shrink-0 overflow-hidden rounded-lg border bg-card">
                <Image
                  src={logo}
                  alt=""
                  fill
                  sizes="40px"
                  className={cn("object-contain", ink && "p-1 dark:brightness-0 dark:invert")}
                />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <p className={cn("text-xs font-semibold", kindInk[kind])}>{t(`kinds.${kind}`)}</p>
                <p className="text-copy font-medium">{t(`${id}.title`)}</p>
                <p className="line-clamp-2 text-sm text-foreground">{t(`${id}.summary`)}</p>
                <p className="text-xs text-muted-foreground">{t(`${id}.meta`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export { SearchPreview };
