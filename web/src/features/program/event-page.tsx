import { CalendarPlusIcon, GlobeIcon, MapPinIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { RichText } from "@/components/composites/rich-text";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getFormatter } from "@/i18n/format-server";

import type { EventRegistration, Me, Program } from "@/lib/api/generated";
import { initials } from "@/lib/initials";
import { publicFileUrl } from "@/lib/storage/upload";

import { calendarFile } from "./event-calendar";
import { EventRegistrationCard } from "./event-registration-card";
import { ProgramBreadcrumb } from "./program-page";
import { AskGenAiFund, DraftBanner } from "./program-parts";

/**
 * The page of an event of GenAI Fund's Luma calendar that people register for here (BEY-245), laid
 * out as Luma's own: the cover, who presents it and the hosts on the left, held in view while the
 * page scrolls; the name, the date as a calendar leaf in the event's own time, the place, a short
 * card whose one button opens the questions, and the description as Luma formats it on the right.
 * On a phone the card follows the date and the place, a bar keeps its button in reach, and the
 * hosts come last. The venue Luma keeps for guests is shown only to a confirmed one.
 */
async function EventPage({
  program,
  registration,
  account,
  askHref,
}: {
  program: Program;
  registration: EventRegistration;
  account: Me | null;
  askHref?: string;
}) {
  const [t, format, locale] = await Promise.all([
    getTranslations("Program.event.page"),
    getFormatter(),
    getLocale(),
  ]);
  const event = program.events[0];
  const zone = registration.zone;
  const startsAt = event ? new Date(event.startsAt) : null;
  const endsAt = event?.endsAt ? new Date(event.endsAt) : null;
  const day = startsAt
    ? format.dateTime(startsAt, { timeZone: zone, weekday: "long", day: "numeric", month: "long" })
    : null;
  const hours = startsAt
    ? endsAt
      ? format.dateTimeRange(startsAt, endsAt, {
          timeZone: zone,
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : format.dateTime(startsAt, {
          timeZone: zone,
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
    : null;
  const city = [event?.city, event?.country].filter(Boolean).join(", ");
  const place = event?.online ? t("online") : city || null;
  const cover = program.coverFileId ? publicFileUrl(program.coverFileId) : null;
  const person = account
    ? { name: account.displayName, email: account.email, consentNeeded: account.consentNeeded }
    : null;
  // The guest's own file, with the venue, once they are in; anyone else's holds the city.
  const calendar =
    !registration.mine?.calendarUrl && startsAt
      ? calendarFile({
          name: program.name,
          startsAt,
          endsAt,
          place: registration.venue ?? place,
          slug: program.slug,
        })
      : null;

  const people = (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="border-b pb-2 text-sm font-medium text-muted-foreground">
          {t("presentedBy")}
        </h2>
        <div className="flex flex-col gap-1.5">
          <Image
            src="/brand/genaifund-logo.png"
            alt={t("presenter")}
            width={1200}
            height={252}
            className="h-6 w-auto self-start dark:hidden"
          />
          <Image
            src="/brand/genaifund-logo-white.png"
            alt={t("presenter")}
            width={1200}
            height={254}
            className="hidden h-6 w-auto self-start dark:block"
          />
          <p className="text-sm text-muted-foreground">{t("presenterLead")}</p>
        </div>
      </section>
      {registration.hosts.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="border-b pb-2 text-sm font-medium text-muted-foreground">
            {t("hostedBy")}
          </h2>
          <ul className="flex flex-col gap-2.5">
            {registration.hosts.map((host) => (
              <li key={host.name} className="flex items-center gap-3">
                <Avatar size="sm">
                  {host.avatarUrl && <AvatarImage src={host.avatarUrl} alt="" />}
                  <AvatarFallback variant="accent">{initials(host.name, host.name)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{host.name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  return (
    <div lang={locale}>
      <DraftBanner program={program} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 pb-28 md:px-8 md:pb-16">
        <ProgramBreadcrumb name={program.name} />
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex flex-col gap-6 md:sticky md:top-24 md:w-80 md:shrink-0">
            {cover && (
              <Image
                src={cover}
                alt=""
                width={640}
                height={640}
                priority
                className="aspect-square w-full rounded-2xl object-cover shadow-sm ring-1 ring-foreground/5"
              />
            )}
            <div className="hidden flex-col gap-6 md:flex">{people}</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{t("free")}</Badge>
                {registration.approval && <Badge variant="secondary">{t("approval")}</Badge>}
              </div>
              <h1 className="text-3xl font-semibold tracking-headline md:text-4xl">
                {program.name}
              </h1>
            </div>
            <dl className="flex flex-col gap-4">
              {startsAt && day && (
                <div className="flex items-center gap-3">
                  <dt className="flex size-11 shrink-0 flex-col overflow-hidden rounded-lg border text-center">
                    <span className="bg-muted py-0.5 text-xs leading-4 font-semibold text-muted-foreground uppercase">
                      {format.dateTime(startsAt, { timeZone: zone, month: "short" })}
                    </span>
                    <span className="flex flex-1 items-center justify-center font-semibold">
                      {format.dateTime(startsAt, { timeZone: zone, day: "numeric" })}
                    </span>
                    <span className="sr-only">{t("when")}</span>
                  </dt>
                  <dd className="flex flex-col">
                    <span className="font-medium">{day}</span>
                    <span className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      {hours}
                      {calendar && (
                        <a
                          href={calendar.href}
                          download={calendar.fileName}
                          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                        >
                          <CalendarPlusIcon aria-hidden="true" className="size-3.5" />
                          {t("addToCalendar")}
                        </a>
                      )}
                    </span>
                  </dd>
                </div>
              )}
              {place && (
                <div className="flex items-center gap-3">
                  <dt className="flex size-11 shrink-0 items-center justify-center rounded-lg border">
                    {event?.online ? (
                      <GlobeIcon aria-hidden="true" className="size-5 text-muted-foreground" />
                    ) : (
                      <MapPinIcon aria-hidden="true" className="size-5 text-muted-foreground" />
                    )}
                    <span className="sr-only">{t("where")}</span>
                  </dt>
                  <dd className="flex flex-col">
                    <span className="font-medium">{registration.venue ?? place}</span>
                    {registration.placeKept && (
                      <span className="text-sm text-muted-foreground">
                        {t(event?.online ? "linkForGuests" : "addressForGuests")}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
            <EventRegistrationCard
              slug={program.slug}
              name={program.name}
              cover={cover}
              when={day ? [day, hours].filter(Boolean).join(" · ") : null}
              registration={registration}
              person={person}
            />
            {program.about && (
              <section className="flex flex-col gap-3">
                <h2 className="border-b pb-2 text-sm font-medium text-muted-foreground">
                  {t("about")}
                </h2>
                <RichText text={program.about} />
              </section>
            )}
            <div className="flex flex-col gap-6 md:hidden">{people}</div>
            {askHref && <AskGenAiFund href={askHref} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export { EventPage };
