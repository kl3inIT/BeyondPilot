import { CheckIcon, CircleCheckIcon, FileTextIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/ui/section";
import { cn } from "cn";

function Tile({
  title,
  text,
  className,
  children,
}: {
  title: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-6 overflow-hidden rounded-xl border border-foreground/5 bg-card p-6",
        className,
      )}
    >
      <div className="flex max-w-115 flex-col gap-2">
        <h3 className="text-xl font-semibold sm:text-2xl">{title}</h3>
        <p className="text-sm text-muted-foreground sm:text-base">{text}</p>
      </div>
      <div className="relative flex flex-1 items-center justify-center">{children}</div>
    </article>
  );
}

/** Real programme posters from genaifund.ai, fanned like a stack of cards. */
function ProgramVisuals() {
  const t = useTranslations("Home.bento.programAlt");

  return (
    <div className="relative h-56 w-full max-w-128 sm:h-84">
      <Image
        src="/programs/demo-day.jpg"
        alt={t("demoDay")}
        width={900}
        height={506}
        className="absolute top-1/3 left-1/24 w-3/5 -rotate-6 rounded-xl border shadow-lg"
      />
      <Image
        src="/programs/workforce-workshops.jpg"
        alt={t("workshops")}
        width={900}
        height={506}
        className="absolute top-3/8 right-1/40 w-3/5 rotate-5 rounded-xl border shadow-lg"
      />
      <Image
        src="/programs/wash3000.jpg"
        alt={t("wash3000")}
        width={900}
        height={506}
        className="absolute top-1/8 left-1/6 w-2/3 rounded-xl border shadow-lg"
      />
    </div>
  );
}

/** One enterprise need receiving proposals; the shortlisted provider stands out. */
function ProviderMatches() {
  const t = useTranslations("Home.bento");
  const k = useTranslations("Home.bento.kinds");

  return (
    <div aria-hidden="true" className="flex w-full flex-col items-center gap-2">
      <span className="flex items-center gap-2.5 rounded-full border bg-background px-4 py-2.5 text-sm shadow-sm">
        <FileTextIcon className="size-3.5 text-muted-foreground" />
        <span className="font-medium">{t("briefPill")}</span>
        <span className="hidden text-muted-foreground sm:inline">{t("briefTeams")}</span>
      </span>
      <div className="flex items-start justify-center">
        <ProviderCard
          logo="/solutions/polymath.svg"
          name="Polymath"
          city="Singapore"
          kind={k("proofInPocket")}
          className="mt-3.5 -mr-6 hidden rotate-7 sm:flex"
        />
        <ProviderCard
          logo="/solutions/peregrin.svg"
          name="Peregrin"
          city="Ho Chi Minh City"
          kind={k("guidedClaims")}
          shortlisted={t("shortlisted")}
          className="z-10 border-brand"
        />
        <ProviderCard
          logo="/solutions/railspeed.svg"
          name="Railspeed"
          city="Bangkok"
          kind={k("renewal")}
          className="mt-3.5 -ml-6 hidden -rotate-7 sm:flex"
        />
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground sm:hidden">
        <Image src="/solutions/polymath.svg" alt="" width={20} height={20} />
        <Image src="/solutions/railspeed.svg" alt="" width={20} height={20} />
        {t("moreProposals")}
      </p>
    </div>
  );
}

function ProviderCard({
  logo,
  name,
  city,
  kind,
  shortlisted,
  className,
}: {
  logo: string;
  name: string;
  city: string;
  kind: string;
  shortlisted?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-46 flex-col items-center gap-2.5 rounded-2xl border bg-background px-4 py-5 text-center shadow-lg",
        className,
      )}
    >
      <Image src={logo} alt="" width={56} height={56} className="size-14" />
      <div className="flex flex-col gap-0.5">
        <p className="text-lg font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">{city}</p>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{kind}</p>
      {shortlisted && (
        <Badge variant="brand">
          <CheckIcon />
          {shortlisted}
        </Badge>
      )}
    </div>
  );
}

/** A browsable directory: logo on a tinted panel, then product name and kind of AI. */
function SolutionDirectory() {
  const k = useTranslations("Home.bento.kinds");
  const solutions = [
    { logo: "/solutions/kintsugi.svg", name: "Kintsugi", kind: k("documentAi") },
    { logo: "/solutions/lightbox.svg", name: "Lightbox", kind: k("vision") },
    { logo: "/solutions/warpspeed.svg", name: "Warpspeed", kind: k("llm") },
    { logo: "/solutions/luminous.svg", name: "Luminous", kind: k("forecasting") },
    { logo: "/solutions/sonorous.svg", name: "Sonorous", kind: k("speech") },
    { logo: "/solutions/codecraft.svg", name: "Codecraft", kind: k("automation") },
  ];

  return (
    <ul aria-hidden="true" className="grid w-full max-w-137 grid-cols-2 gap-4 sm:grid-cols-3">
      {solutions.map((solution, index) => (
        <li
          key={solution.name}
          className={cn(
            "flex flex-col overflow-hidden rounded-xl border bg-background shadow-sm",
            index > 3 && "hidden sm:flex",
          )}
        >
          <div className="flex h-26 items-center justify-center bg-muted/60">
            <Image src={solution.logo} alt="" width={48} height={48} className="size-12" />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5 px-3.5 py-3">
            <p className="truncate text-sm font-semibold">{solution.name}</p>
            <p className="truncate text-xs text-muted-foreground">{solution.kind}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Southeast Asia drawn from Natural Earth land data, with talent placed on their cities. */
function TalentMap() {
  const t = useTranslations("Home.bento");
  const people = [
    { photo: "/talent/face-12.jpg", position: "top-1/8 left-2/5" },
    { photo: "/talent/face-5.jpg", position: "top-1/3 left-1/4" },
    { photo: "/talent/face-32.jpg", position: "top-2/5 left-2/5" },
    { photo: "/talent/face-15.jpg", position: "top-3/10 left-4/5" },
    { photo: "/talent/face-68.jpg", position: "top-7/8 left-2/5" },
  ];

  return (
    <div aria-hidden="true" className="flex w-full flex-col items-center gap-4">
      <div className="relative aspect-square w-full max-w-80 sm:max-w-97">
        <Image
          src="/talent/southeast-asia-dots.svg"
          alt=""
          fill
          className="object-contain dark:invert"
        />
        {people.map((person) => (
          <Image
            key={person.photo}
            src={person.photo}
            alt=""
            width={64}
            height={64}
            className={cn(
              "absolute size-8 -translate-1/2 rounded-full border-2 border-background shadow-md",
              person.position,
            )}
          />
        ))}
        {/* Singapore: the highlighted specialist, with the bubble beside them from sm. */}
        <Image
          src="/talent/face-47.jpg"
          alt=""
          width={64}
          height={64}
          className="absolute top-2/3 left-1/3 size-8 -translate-1/2 rounded-full border-2 border-brand shadow-lg"
        />
        <span className="absolute top-5/8 left-2/5 hidden items-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium whitespace-nowrap shadow-sm sm:flex">
          <CircleCheckIcon className="size-3.5 text-success" />
          {t("talentBubble")}
        </span>
      </div>
      <span className="flex items-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium shadow-sm sm:hidden">
        <CircleCheckIcon className="size-3.5 text-success" />
        {t("talentBubble")}
      </span>
    </div>
  );
}

function PlatformBento() {
  const t = useTranslations("Home.bento");

  return (
    <Section>
      <div className="flex flex-col gap-8 sm:gap-12">
        <h2 className="text-center text-3xl font-semibold text-balance sm:text-left sm:text-5xl sm:leading-none">
          {t("title")}
        </h2>
        <div className="grid gap-4 md:grid-cols-20">
          <Tile title={t("programs")} text={t("programsText")} className="md:col-span-9">
            <ProgramVisuals />
          </Tile>
          <Tile title={t("useCases")} text={t("useCasesText")} className="md:col-span-11">
            <ProviderMatches />
          </Tile>
          <Tile title={t("solutions")} text={t("solutionsText")} className="md:col-span-11">
            <SolutionDirectory />
          </Tile>
          <Tile title={t("talent")} text={t("talentText")} className="md:col-span-9">
            <TalentMap />
          </Tile>
        </div>
      </div>
    </Section>
  );
}

export { PlatformBento };
