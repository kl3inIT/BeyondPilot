import { cn } from "cn";
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

const paths = [
  {
    id: "solution",
    href: siteRoutes.workspaceSolutions,
    photo: "path-solutions",
    tint: "bg-sky",
    ink: "text-sky-foreground",
  },
  {
    id: "problem",
    href: siteRoutes.publishUseCase,
    photo: "path-use-cases",
    tint: "bg-mint",
    ink: "text-mint-foreground",
  },
  {
    id: "talent",
    href: siteRoutes.talentProfile,
    photo: "path-talent",
    tint: "bg-peach",
    ink: "text-peach-foreground",
  },
] as const;

/** Three doors into the product, one for each kind of visitor. */
function AudiencePaths() {
  const t = useTranslations("HowItWorks.paths");

  return (
    <Section>
      <div className="flex flex-col gap-10 py-16 lg:py-24">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-primary">{t("eyebrow")}</p>
          <h2 className="text-3xl font-semibold tracking-headline md:text-4xl">{t("title")}</h2>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {paths.map(({ id, href, photo, tint, ink }) => (
            <li key={id} className="flex">
              <article className={cn("flex w-full flex-col gap-3 rounded-2xl p-3 pb-6", tint)}>
                <Image
                  src={`/landing/how-it-works/${photo}.jpg`}
                  alt=""
                  width={432}
                  height={280}
                  sizes="(min-width: 768px) 30vw, 100vw"
                  className="h-30 w-full rounded-xl object-cover"
                />
                <h3 className="text-2xl font-semibold">{t(`${id}.title`)}</h3>
                <p className="flex-1 text-base text-foreground/80">{t(`${id}.description`)}</p>
                <TextButton href={href} size="lg" className={cn("self-start", ink)}>
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

export { AudiencePaths };
