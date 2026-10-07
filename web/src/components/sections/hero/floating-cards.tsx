import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";

/** A program a floating card shows: one open or to come, or the latest that ended. */
type HeroProgram = {
  name: string;
  type: string;
  partnerName: string | null;
  coverUrl: string | null;
};

/** The live content of the floating cards; a card whose content could not be read is left out. */
export type HeroCardsData = {
  featured: HeroProgram | null;
  past: HeroProgram | null;
  /** The next session of an event series; `recurring` is the GenAI Builders Meetup, whose hours are known. */
  nextEvent: { name: string; startsAt: string; recurring: boolean } | null;
};

/**
 * Real things float around the search (DESIGN.md › Cards › Floating card): the demo-day photo, the
 * WASH3000 program, the next meetup, two founders and two partner logos. Each one repeats a fact
 * the page states again below, so the cards are hidden from assistive technology. They slide in
 * from their side, then rise and settle once, as the Figma Motion timeline plays them. Figma tilts
 * a card counter-clockwise about its top-left corner, hence the negated angles and that origin.
 */
function FloatingCards({ cards }: { cards: HeroCardsData }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {cards.past && (
        <div className="absolute top-154.5 left-27.5 w-50 animate-in delay-450 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none desktop:top-17.5 desktop:left-23 desktop:w-64">
          <ProgramCard
            program={cards.past}
            className="origin-top-left -rotate-6 animate-bob delay-2200 motion-reduce:animate-none"
          />
        </div>
      )}
      {cards.featured && (
        <div className="absolute top-62.5 right-18.5 hidden w-64 animate-in delay-570 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:block">
          <ProgramCard
            program={cards.featured}
            className="origin-top-left rotate-5 animate-bob delay-2700 motion-reduce:animate-none"
          />
        </div>
      )}
      {cards.nextEvent && (
        <div className="absolute top-16 right-6.75 animate-in delay-510 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:top-23 desktop:right-21.75">
          <MeetupCard
            event={cards.nextEvent}
            className="origin-top-left rotate-3 animate-bob-deep delay-2450 motion-reduce:animate-none"
          />
        </div>
      )}
      <div className="absolute top-15 left-15 animate-in delay-930 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none desktop:top-152.5 desktop:left-37.5">
        <PersonCard
          photo="/founders/tuan.jpg"
          name="Tuan Cao"
          role="CEO, LIFE AI"
          className="animate-bob-deep delay-2700 motion-reduce:animate-none"
        />
      </div>
      <div className="absolute top-160 right-22.75 animate-in delay-990 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:top-157.5 desktop:right-41.75">
        <PersonCard
          photo="/founders/anh.jpg"
          name="Anh Ta"
          role="Founder & CEO, Arcanic AI"
          className="animate-bob delay-2200 motion-reduce:animate-none"
        />
      </div>
      <div className="absolute top-82.5 left-6 animate-in delay-690 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none desktop:top-93 desktop:left-18">
        <div className="flex animate-bob-deep items-center rounded-xl border bg-card px-4 py-3 opacity-80 shadow-tile delay-2200 motion-reduce:animate-none">
          <Image
            src="/partners/nvidia.png"
            alt="NVIDIA"
            width={400}
            height={200}
            sizes="6rem"
            className="h-12 w-24 object-contain dark:invert"
          />
        </div>
      </div>
      <div className="absolute top-90 right-5 animate-in delay-870 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:top-117.5 desktop:right-14">
        <div className="flex animate-bob items-center rounded-xl border bg-card px-4 py-3 shadow-float delay-2450 motion-reduce:animate-none">
          <Image
            src="/partners/aws.png"
            alt="AWS"
            width={400}
            height={200}
            sizes="5rem"
            className="h-10 w-20 object-contain dark:invert"
          />
        </div>
      </div>
    </div>
  );
}

/** The phone arrangement: the meetup on top, two photos side by side, a founder below. */
function FloatingCardsStack({ cards }: { cards: HeroCardsData }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-85 w-full max-w-87.5 lg:hidden">
      {cards.nextEvent && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-in delay-510 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none">
          <MeetupCard
            event={cards.nextEvent}
            className="origin-top-left rotate-3 animate-bob-deep delay-2450 motion-reduce:animate-none"
          />
        </div>
      )}
      {cards.past && (
        <div className="absolute top-21.5 left-1.5 w-12/25 max-w-42 animate-in delay-450 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none">
          <ProgramCard
            program={cards.past}
            className="origin-top-left -rotate-6 animate-bob delay-2200 motion-reduce:animate-none"
          />
        </div>
      )}
      {cards.featured && (
        <div className="absolute top-25 right-1.5 w-12/25 max-w-42 animate-in delay-570 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none">
          <ProgramCard
            program={cards.featured}
            className="origin-top-left rotate-5 animate-bob delay-2700 motion-reduce:animate-none"
          />
        </div>
      )}
      <div className="absolute top-67 left-1/2 -translate-x-1/2 animate-in delay-990 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none">
        <PersonCard
          photo="/founders/anh.jpg"
          name="Anh Ta"
          role="Founder & CEO, Arcanic AI"
          className="animate-bob delay-2200 motion-reduce:animate-none"
        />
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  meta,
  title,
  className,
}: {
  photo: string | null;
  meta: string;
  title: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-card p-2 pb-3 text-card-foreground shadow-float",
        className,
      )}
    >
      {photo ? (
        <Image
          src={photo}
          alt=""
          width={900}
          height={506}
          unoptimized
          className="aspect-video w-full rounded-lg object-cover"
        />
      ) : (
        <div className="aspect-video w-full rounded-lg bg-linear-155 from-primary to-brand" />
      )}
      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{meta}</p>
        <p className="line-clamp-2 text-sm font-semibold">{title}</p>
      </div>
    </div>
  );
}

function ProgramCard({ program, className }: { program: HeroProgram; className?: string }) {
  const kinds = useTranslations("Program.type") as unknown as (code: string) => string;
  const kind = kinds(program.type);

  return (
    <PhotoCard
      photo={program.coverUrl}
      meta={program.partnerName ? `${kind} · ${program.partnerName}` : kind}
      title={program.name}
      className={className}
    />
  );
}

function MeetupCard({
  event,
  className,
}: {
  event: NonNullable<HeroCardsData["nextEvent"]>;
  className?: string;
}) {
  const t = useTranslations("Home");
  const format = useFormatter();
  const startsAt = new Date(event.startsAt);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card py-2.5 pr-4.5 pl-2.5 text-card-foreground shadow-float",
        className,
      )}
    >
      <div className="flex w-10 flex-col items-center rounded-lg border bg-muted">
        <span className="text-xs font-semibold text-primary uppercase">
          {t("events.tileMonth", { date: startsAt })}
        </span>
        <span className="text-lg font-semibold">
          {format.dateTime(startsAt, { day: "numeric" })}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 whitespace-nowrap">
        <p className="text-sm font-semibold">{event.name}</p>
        <p className="text-xs font-medium text-muted-foreground">
          {event.recurring
            ? t("hero.meetupTime")
            : format.dateTime(startsAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}
        </p>
      </div>
    </div>
  );
}

function PersonCard({
  photo,
  name,
  role,
  className,
}: {
  photo: string;
  name: string;
  role: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card py-2.5 pr-4.5 pl-2.5 text-card-foreground shadow-float",
        className,
      )}
    >
      <Image
        src={photo}
        alt={name}
        width={320}
        height={320}
        sizes="2.5rem"
        className="size-10 rounded-2xl object-cover"
      />
      <div className="flex flex-col gap-0.5 whitespace-nowrap">
        <p className="text-sm font-semibold">{name}</p>
        <p className="text-xs font-medium text-muted-foreground">{role}</p>
      </div>
    </div>
  );
}

export { FloatingCards, FloatingCardsStack };
