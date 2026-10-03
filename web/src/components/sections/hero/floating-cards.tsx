import { cn } from "cn";
import { useFormatter, useTranslations } from "next-intl";
import Image from "next/image";

/** The next GenAI Builders Meetup, Tuesday 13 October 2026, 4 pm in Ho Chi Minh City. */
const nextMeetup = new Date("2026-10-13T16:00:00+07:00");

/**
 * Real things float around the search (DESIGN.md › Cards › Floating card): the demo-day photo, the
 * WASH3000 program, the next meetup, two founders and two partner logos. Each one repeats a fact
 * the page states again below, so the cards are hidden from assistive technology. They slide in
 * from their side, then rise and settle once, as the Figma Motion timeline plays them. Figma tilts
 * a card counter-clockwise about its top-left corner, hence the negated angles and that origin.
 */
function FloatingCards() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <div className="absolute top-154.5 left-27.5 w-50 animate-in delay-450 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none desktop:top-17.5 desktop:left-23 desktop:w-64">
        <DemoDayCard className="origin-top-left -rotate-6 animate-bob delay-2200 motion-reduce:animate-none" />
      </div>
      <div className="absolute top-62.5 right-18.5 hidden w-64 animate-in delay-570 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:block">
        <WashCard className="origin-top-left rotate-5 animate-bob delay-2700 motion-reduce:animate-none" />
      </div>
      <div className="absolute top-16 right-6.75 animate-in delay-510 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none desktop:top-23 desktop:right-21.75">
        <MeetupCard className="origin-top-left rotate-3 animate-bob-deep delay-2450 motion-reduce:animate-none" />
      </div>
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
            className="h-10 w-20 object-contain dark:invert"
          />
        </div>
      </div>
    </div>
  );
}

/** The phone arrangement: the meetup on top, two photos side by side, a founder below. */
function FloatingCardsStack() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-85 w-full max-w-87.5 lg:hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 animate-in delay-510 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none">
        <MeetupCard className="origin-top-left rotate-3 animate-bob-deep delay-2450 motion-reduce:animate-none" />
      </div>
      <div className="absolute top-21.5 left-1.5 w-12/25 max-w-42 animate-in delay-450 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-left-14 motion-reduce:animate-none">
        <DemoDayCard
          compact
          className="origin-top-left -rotate-6 animate-bob delay-2200 motion-reduce:animate-none"
        />
      </div>
      <div className="absolute top-25 right-1.5 w-12/25 max-w-42 animate-in delay-570 ease-entrance animation-duration-1100 fill-mode-both fade-in slide-in-from-right-14 motion-reduce:animate-none">
        <WashCard className="origin-top-left rotate-5 animate-bob delay-2700 motion-reduce:animate-none" />
      </div>
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
  alt,
  meta,
  title,
  className,
}: {
  photo: string;
  alt: string;
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
      <Image
        src={photo}
        alt={alt}
        width={900}
        height={506}
        sizes="16rem"
        className="aspect-video w-full rounded-lg object-cover"
      />
      <div className="flex flex-col gap-0.5 px-0.5">
        <p className="truncate text-xs font-medium text-muted-foreground">{meta}</p>
        <p className="text-sm font-semibold">{title}</p>
      </div>
    </div>
  );
}

function DemoDayCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const t = useTranslations("Home.hero");

  return (
    <PhotoCard
      photo="/programs/demo-day.jpg"
      alt={t("demoDayAlt")}
      meta={compact ? t("demoDayMetaShort") : t("demoDayMeta")}
      title={compact ? t("demoDayTitleShort") : t("demoDayTitle")}
      className={className}
    />
  );
}

function WashCard({ className }: { className?: string }) {
  const t = useTranslations("Home.hero");

  return (
    <PhotoCard
      photo="/programs/wash3000.jpg"
      alt={t("washAlt")}
      meta={t("washMeta")}
      title={t("washTitle")}
      className={className}
    />
  );
}

function MeetupCard({ className }: { className?: string }) {
  const t = useTranslations("Home");
  const format = useFormatter();

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card py-2.5 pr-4.5 pl-2.5 text-card-foreground shadow-float",
        className,
      )}
    >
      <div className="flex w-10 flex-col items-center rounded-lg border bg-muted">
        <span className="text-xs font-semibold text-primary uppercase">
          {t("events.tileMonth", { date: nextMeetup })}
        </span>
        <span className="text-lg font-semibold">
          {format.dateTime(nextMeetup, { day: "numeric" })}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 whitespace-nowrap">
        <p className="text-sm font-semibold">{t("events.meetup")}</p>
        <p className="text-xs font-medium text-muted-foreground">{t("hero.meetupTime")}</p>
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
