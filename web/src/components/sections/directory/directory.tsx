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
import { useVocabulary } from "@/i18n/vocabulary";
import { initials } from "@/lib/initials";
import { programRoute, siteRoutes } from "@/lib/site";

/** A program as its directory card shows it. */
export type DirectoryProgram = {
  slug: string;
  name: string;
  type: string;
  partnerName: string | null;
  coverUrl: string | null;
  open: boolean;
  /** When applications close, for a program open now. */
  closesAt: string | null;
};

/** What the directory section shows; a count is null when it could not be read. */
export type DirectoryData = {
  counts: { programs: number | null; useCases: number | null; solutions: number | null };
  programs: DirectoryProgram[];
  useCases: { id: string; title: string; industry: string }[];
  solutions: {
    slug: string;
    name: string;
    summary: string | null;
    country: string | null;
    logoUrl: string | null;
  }[];
};

/** Photos of GenAI Fund's own events behind the use case cards, one per position. */
const useCasePhotos = [
  { alt: "contactCentreAlt", src: "/landing/uc-contact-centre.jpg", width: 1200 },
  { alt: "safetyAlt", src: "/landing/uc-safety-vision.jpg", width: 1168 },
  { alt: "shelfAlt", src: "/landing/uc-shelf-monitoring.jpg", width: 1200 },
] as const;

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

/** A stored cover, read at the public address of stored files. */
function StoredCover({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={900}
      height={506}
      unoptimized
      className="size-full object-cover"
    />
  );
}

/** A solution's logo, or its initials, on a soft gradient of its kind's accent. */
function LogoCover({ src, name, alt }: { src: string | null; name: string; alt: string }) {
  return (
    <div className="flex size-full items-center justify-center bg-linear-155 from-solution/15 to-solution/50">
      <div className="relative flex size-18 items-center justify-center overflow-hidden rounded-2xl bg-card text-xl font-semibold text-muted-foreground shadow-mark">
        {src ? (
          <Image src={src} alt={alt} fill sizes="4.5rem" unoptimized className="object-cover" />
        ) : (
          <span aria-hidden="true">{initials(name, name)}</span>
        )}
      </div>
    </div>
  );
}

/** A program without a cover of its own: the azure ground with a trophy, and its badge while open. */
function TrophyCover({ badge }: { badge: string | null }) {
  return (
    <div className="flex size-full flex-col items-start justify-between bg-linear-155 from-primary to-brand px-5 pt-4 pb-5">
      {badge ? <Badge variant="success">{badge}</Badge> : <span />}
      <div className="flex size-14 items-center justify-center rounded-xl bg-card shadow-mark">
        <TrophyIcon className="size-7 text-primary" strokeWidth={1.75} aria-hidden="true" />
      </div>
    </div>
  );
}

/** A program's cover: its own when it has one, with the badge over it while it is open. */
function ProgramCover({ program, badge }: { program: DirectoryProgram; badge: string }) {
  if (!program.coverUrl) {
    return <TrophyCover badge={program.open ? badge : null} />;
  }
  return (
    <>
      <StoredCover src={program.coverUrl} />
      {program.open && (
        <Badge variant="success" className="absolute top-4 left-5">
          {badge}
        </Badge>
      )}
    </>
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

/** The words before a program's name: its kind, and the partner it runs with. */
function programMeta(kind: string, partnerName: string | null) {
  return partnerName ? `${kind} · ${partnerName}` : kind;
}

/**
 * "Explore the directory": underline tabs with a kind icon and a count over a three-card grid
 * (DESIGN.md › Directory tabs). Phones show the first card and a link to the full list. The counts
 * and cards are the directories' own; a count that could not be read is left out.
 */
function Directory({ data }: { data: DirectoryData }) {
  const t = useTranslations("Home.directory");
  const c = useTranslations("Campaign");
  const kinds = useTranslations("Program.type") as unknown as (code: string) => string;
  const industry = useVocabulary("industry");
  const country = useVocabulary("country");
  const format = useFormatter();
  const { counts } = data;

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
              {counts.programs !== null && <Count>{format.number(counts.programs)}</Count>}
            </TabsTrigger>
            <TabsTrigger value="use-cases">
              <Building2Icon className="text-use-case max-md:hidden" aria-hidden="true" />
              {t("useCases")}
              {counts.useCases !== null && <Count>{format.number(counts.useCases)}</Count>}
            </TabsTrigger>
            <TabsTrigger value="solutions">
              <BoxesIcon className="text-solution max-md:hidden" aria-hidden="true" />
              {t("solutions")}
              {counts.solutions !== null && <Count>{format.number(counts.solutions)}</Count>}
            </TabsTrigger>
            <TabsTrigger value="talent">
              <UsersIcon className="text-talent max-md:hidden" aria-hidden="true" />
              {t("talent")}
              <Count>{t("new")}</Count>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="programs">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              {data.programs.map((program) => (
                <DirectoryCard
                  key={program.slug}
                  cover={<ProgramCover program={program} badge={c("live")} />}
                  meta={programMeta(kinds(program.type), program.partnerName)}
                  title={program.name}
                  footer={
                    program.closesAt ? (
                      <p className="text-xs font-medium text-primary">
                        {t("closesOn", { date: new Date(program.closesAt) })}
                      </p>
                    ) : (
                      <CardLink href={programRoute(program.slug)}>{t("viewProgram")}</CardLink>
                    )
                  }
                />
              ))}
            </ul>
            <SeeAll href={siteRoutes.programs}>
              {counts.programs !== null
                ? t("seeAllPrograms", { count: counts.programs })
                : t("seeAllProgramsPlain")}
            </SeeAll>
          </TabsContent>

          <TabsContent value="use-cases">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              {data.useCases.map((useCase, index) => {
                const photo = useCasePhotos[index % useCasePhotos.length];
                return (
                  <DirectoryCard
                    key={useCase.id}
                    cover={
                      <PhotoCover
                        src={photo.src}
                        alt={t(photo.alt)}
                        width={photo.width}
                        height={photo.width / 2}
                      />
                    }
                    meta={t("useCaseMeta", { industry: industry(useCase.industry) })}
                    title={useCase.title}
                    footer={<CardLink href={siteRoutes.useCases}>{t("viewUseCase")}</CardLink>}
                    twoLineTitle
                  />
                );
              })}
            </ul>
            <SeeAll href={siteRoutes.useCases}>
              {counts.useCases !== null
                ? t("seeAllUseCases", { count: counts.useCases })
                : t("seeAllUseCasesPlain")}
            </SeeAll>
          </TabsContent>

          <TabsContent value="solutions">
            <ul className="mt-3 grid gap-5 lg:grid-cols-3">
              {data.solutions.map((solution) => (
                <DirectoryCard
                  key={solution.slug}
                  cover={
                    <LogoCover
                      src={solution.logoUrl}
                      name={solution.name}
                      alt={t("logoAlt", { name: solution.name })}
                    />
                  }
                  meta={
                    solution.country
                      ? t("solutionMeta", { country: country(solution.country) })
                      : t("solutionMetaPlain")
                  }
                  title={solution.name}
                  footer={
                    solution.summary ? (
                      <p className="line-clamp-2 text-xs font-medium text-muted-foreground">
                        {solution.summary}
                      </p>
                    ) : (
                      <CardLink href={`${siteRoutes.solutions}/${solution.slug}`}>
                        {t("viewSolution")}
                      </CardLink>
                    )
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
