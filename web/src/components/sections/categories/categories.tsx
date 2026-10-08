import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Section } from "@/components/ui/section";
import { siteRoutes } from "@/lib/site";

const categories = [
  { id: "solutions", href: siteRoutes.solutions, photo: "/landing/uc-shelf-monitoring.jpg" },
  { id: "talent", href: siteRoutes.talent, photo: "/landing/talent-aabw-builders.jpg" },
  { id: "useCases", href: siteRoutes.useCases, photo: "/landing/uc-contact-centre.jpg" },
  {
    id: "events",
    href: `${siteRoutes.programs}?type=event`,
    photo: "/landing/cover-aabw-2026.jpg",
  },
  { id: "programs", href: siteRoutes.programs, photo: "/landing/explore-programs.jpg" },
] as const;

/** Five ways into the product's directories and the program list. */
function Categories() {
  const t = useTranslations("Home.categories");

  return (
    <Section>
      <div className="flex flex-col pb-16 lg:pb-25">
        <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-headline lg:text-section lg:tracking-section">
          {t("title")}
        </h2>
        <ul className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
          {categories.map(({ id, href, photo }) => (
            <li key={id} className="flex min-w-0">
              <article className="flex w-full flex-col rounded-2xl border bg-muted p-3">
                <Image
                  src={photo}
                  alt=""
                  width={432}
                  height={280}
                  sizes="(min-width: 1024px) 14rem, (min-width: 640px) 50vw, 100vw"
                  className="aspect-216/140 w-full rounded-xl object-cover"
                />
                <div className="flex flex-1 flex-col px-2 pt-5 pb-2">
                  <h3 className="text-xl font-semibold">{t(`${id}.title`)}</h3>
                  <p className="mt-3.5 text-copy text-muted-foreground">{t(`${id}.description`)}</p>
                  <TextButton href={href} className="mt-auto self-start pt-6 font-normal">
                    {t(`${id}.action`)}
                    <ArrowRightIcon aria-hidden="true" />
                  </TextButton>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Categories };
