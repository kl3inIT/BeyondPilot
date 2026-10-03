import { cva } from "class-variance-authority";
import {
  ArrowRightIcon,
  BoxesIcon,
  Building2Icon,
  CalendarDaysIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";

import { TextButton } from "@/components/actions/text-button";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { siteRoutes } from "@/lib/site";

/** Sizes of the GenAI Fund catalogue that BeyondPilot takes over (PRODUCT.md › Operating Context). */
const counts = { programs: 21, useCases: 208, solutions: 2500 } as const;

const cardTitle = cva("line-clamp-2 flex-1 text-lg font-semibold", {
  variants: { twoLineTitle: { true: "min-h-14", false: "" } },
});

type CardProps = {
  cover: React.ReactNode;
  meta: string;
  title: string;
  footer: React.ReactNode;
  /** Use cases keep room for a second title line, so their links line up whatever the title. */
  twoLineTitle?: boolean;
};

/** A cover card (DESIGN.md › Cards): a 200px cover above a meta line, a title and one link or fact. */
function DirectoryCard({ cover, meta, title, footer, twoLineTitle = false }: CardProps) {
  return (
    <li className="flex min-w-68 flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-tile max-lg:not-first:hidden">
      <div className="relative h-50 shrink-0 overflow-hidden">{cover}</div>
      <div className="flex flex-1 flex-col items-start gap-1.5 px-5 pt-4 pb-5">
        <p className="text-xs font-medium text-muted-foreground">{meta}</p>
        <h3 className={cardTitle({ twoLineTitle })}>{title}</h3>
        {footer}
      </div>
    </li>
  );
}

function PhotoCover({
  src,
  alt,
  width,
  height,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      sizes="(min-width: 1024px) 27rem, 100vw"
      className="size-full object-cover"
    />
  );
}

/** A solution's logo on a soft gradient of its kind's accent. */
function LogoCover({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex size-full items-center justify-center bg-linear-155 from-solution/15 to-solution/50">
      <div className="relative size-18 overflow-hidden rounded-2xl bg-card shadow-mark">
        <Image src={src} alt={alt} fill sizes="4.5rem" className="object-cover" />
      </div>
    </div>
  );
}

function CardLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <TextButton size="sm" href={href}>
      {children}
      <ArrowRightIcon aria-hidden="true" />
    </TextButton>
  );
}

function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <TextButton className="mt-6 lg:hidden" href={href}>
      {children}
      <ArrowRightIcon aria-hidden="true" />
    </TextButton>
  );
}

/**
 * "Explore the directory": underline tabs with a kind icon and a count over a three-card grid
 * (DESIGN.md › Directory tabs). Phones show the first card and a link to the full list.
 */
function Directory() {
  const t = useTranslations("Home.directory");
  const c = useTranslations("Campaign");
  const format = useFormatter();

  return (
    <Section>
      <div className="flex flex-col gap-6 pt-14 pb-20 md:gap-10 md:pt-20 md:pb-28">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <h2 className="text-3xl font-semibold tracking-title md:text-headline md:tracking-headline">
            {t("title")}
          </h2>
          <TextButton href={siteRoutes.publishUseCase}>
            {t("publish")}
            <ArrowRightIcon aria-hidden="true" />
          </TextButton>
        </div>
        <Tabs defaultValue="use-cases">
          <TabsList variant="underline" aria-label={t("tabsLabel")}>
            <TabsTrigger value="programs">
              <CalendarDaysIcon className="text-primary max-md:hidden" aria-hidden="true" />
              <span className="md:hidden">{t("programsShort")}</span>
              <span className="max-md:hidden">{t("programs")}</span>
              <Count>{format.number(counts.programs)}</Count>
            </TabsTrigger>
            <TabsTrigger value="use-cases">
              <Building2Icon className="text-use-case max-md:hidden" aria-hidden="true" />
              {t("useCases")}
              <Count>{format.number(counts.useCases)}</Count>
            </TabsTrigger>
            <TabsTrigger value="solutions">
              <BoxesIcon className="text-solution max-md:hidden" aria-hidden="true" />
              {t("solutions")}
              <Count>{t("approx", { count: counts.solutions })}</Count>
            </TabsTrigger>
            <TabsTrigger value="talent">
              <UsersIcon className="text-talent max-md:hidden" aria-hidden="true" />
              {t("talent")}
              <Count>{t("new")}</Count>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="programs">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              <DirectoryCard
                cover={
                  <div className="flex size-full flex-col items-start justify-between bg-linear-155 from-primary to-brand px-5 pt-4 pb-5">
                    <Badge variant="success">{c("live")}</Badge>
                    <div className="flex size-14 items-center justify-center rounded-xl bg-card shadow-mark">
                      <TrophyIcon
                        className="size-7 text-primary"
                        strokeWidth={1.75}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                }
                meta={t("tascoMeta")}
                title={c("name")}
                footer={<p className="text-xs font-medium text-primary">{c("closes")}</p>}
              />
              <DirectoryCard
                cover={
                  <PhotoCover
                    src="/programs/wash3000.jpg"
                    alt={t("washAlt")}
                    width={900}
                    height={506}
                  />
                }
                meta={t("washMeta")}
                title={t("washTitle")}
                footer={<CardLink href={siteRoutes.programs}>{t("viewProgram")}</CardLink>}
              />
              <DirectoryCard
                cover={
                  <PhotoCover
                    src="/landing/cover-ai-workforce-shift.jpg"
                    alt={t("workforceAlt")}
                    width={1166}
                    height={351}
                  />
                }
                meta={t("workforceMeta")}
                title={t("workforceTitle")}
                footer={
                  <p className="text-xs font-medium text-muted-foreground">{t("workforceFact")}</p>
                }
              />
            </ul>
            <SeeAll href={siteRoutes.programs}>
              {t("seeAllPrograms", { count: counts.programs })}
            </SeeAll>
          </TabsContent>

          <TabsContent value="use-cases">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              {(
                [
                  { id: "contactCentre", src: "/landing/uc-contact-centre.jpg", width: 1200 },
                  { id: "safety", src: "/landing/uc-safety-vision.jpg", width: 1168 },
                  { id: "shelf", src: "/landing/uc-shelf-monitoring.jpg", width: 1200 },
                ] as const
              ).map(({ id, src, width }) => (
                <DirectoryCard
                  key={id}
                  cover={
                    <PhotoCover src={src} alt={t(`${id}Alt`)} width={width} height={width / 2} />
                  }
                  meta={t(`${id}Meta`)}
                  title={t(`${id}Title`)}
                  footer={<CardLink href={siteRoutes.useCases}>{t("viewUseCase")}</CardLink>}
                  twoLineTitle
                />
              ))}
            </ul>
            <SeeAll href={siteRoutes.useCases}>
              {t("seeAllUseCases", { count: counts.useCases })}
            </SeeAll>
          </TabsContent>

          <TabsContent value="solutions">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              {(
                [
                  { id: "revve", name: "Revve AI", logo: "/landing/logo-revve.jpeg" },
                  { id: "ourteam", name: "ourteam", logo: "/landing/logo-ourteam.png" },
                  { id: "superagent", name: "Superagent", logo: "/landing/logo-superagent.jpeg" },
                ] as const
              ).map(({ id, name, logo }) => (
                <DirectoryCard
                  key={id}
                  cover={<LogoCover src={logo} alt={t("logoAlt", { name })} />}
                  meta={t(`${id}Meta`)}
                  title={name}
                  footer={
                    <p className="text-xs font-medium text-muted-foreground">{t(`${id}Text`)}</p>
                  }
                />
              ))}
            </ul>
            <SeeAll href={siteRoutes.solutions}>{t("seeAllSolutions")}</SeeAll>
          </TabsContent>

          <TabsContent value="talent">
            <ul className="mt-3 grid gap-5">
              <DirectoryCard
                cover={
                  <PhotoCover
                    src="/landing/talent-aabw-builders.jpg"
                    alt={t("talentAlt")}
                    width={1400}
                    height={438}
                  />
                }
                meta={t("talentMeta")}
                title={t("talentTitle")}
                footer={<CardLink href={siteRoutes.talentProfile}>{t("talentLink")}</CardLink>}
              />
            </ul>
          </TabsContent>
        </Tabs>
      </div>
    </Section>
  );
}

/** A tab's count: azure on the active tab, hidden on phones. */
function Count({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium text-muted-foreground in-data-active:text-primary max-md:hidden">
      {children}
    </span>
  );
}

export { Directory };
