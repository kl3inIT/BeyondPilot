import { CalendarDaysIcon, GlobeIcon, MapPinIcon } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";

import { getFormatter } from "@/i18n/format-server";

import type { EventRegistration, Me, Program } from "@/lib/api/generated";
import { publicFileUrl } from "@/lib/storage/upload";

import { EventRegistrationCard } from "./event-registration-card";
import { ProgramBreadcrumb } from "./program-page";
import { AskGenAiFund, DraftBanner } from "./program-parts";

/**
 * The page of an event of GenAI Fund's Luma calendar that people register for here (BEY-245), laid
 * out as Luma's own: the cover and the hosts on the left; the name, the date in the event's own
 * time, the place, the card to register and the description on the right. On a phone the card
 * follows the date and the place, and the hosts come last. The venue Luma keeps for guests is
 * shown only to a confirmed one.
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
  const person = account
    ? { name: account.displayName, email: account.email, consentNeeded: account.consentNeeded }
    : null;

  const hosts = registration.hosts.length > 0 && (
    <section className="flex flex-col gap-2">
      <h2 className="border-b pb-2 text-sm font-medium text-muted-foreground">{t("hostedBy")}</h2>
      <ul className="flex flex-col gap-1.5">
        {registration.hosts.map((host) => (
          <li key={host} className="text-sm font-medium">
            {host}
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <div lang={locale}>
      <DraftBanner program={program} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-6 pb-16 md:px-8">
        <ProgramBreadcrumb name={program.name} />
        <div className="flex flex-col gap-8 md:flex-row md:items-start">
          <div className="flex flex-col gap-6 md:w-80 md:shrink-0">
            {program.coverFileId && (
              <Image
                src={publicFileUrl(program.coverFileId)}
                alt=""
                width={640}
                height={640}
                priority
                className="aspect-square w-full rounded-2xl object-cover"
              />
            )}
            <div className="hidden md:block">{hosts}</div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <h1 className="text-3xl font-semibold tracking-headline md:text-4xl">{program.name}</h1>
            <dl className="flex flex-col gap-4">
              {day && (
                <div className="flex items-start gap-3">
                  <dt className="flex size-10 shrink-0 items-center justify-center rounded-lg border">
                    <CalendarDaysIcon aria-hidden="true" className="size-5 text-muted-foreground" />
                    <span className="sr-only">{t("when")}</span>
                  </dt>
                  <dd className="flex flex-col">
                    <span className="font-medium">{day}</span>
                    {hours && <span className="text-sm text-muted-foreground">{hours}</span>}
                  </dd>
                </div>
              )}
              {place && (
                <div className="flex items-start gap-3">
                  <dt className="flex size-10 shrink-0 items-center justify-center rounded-lg border">
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
              registration={registration}
              person={person}
            />
            {program.about && (
              <section className="flex flex-col gap-3">
                <h2 className="border-b pb-2 text-sm font-medium text-muted-foreground">
                  {t("about")}
                </h2>
                <p className="whitespace-pre-line text-muted-foreground">{program.about}</p>
              </section>
            )}
            <div className="md:hidden">{hosts}</div>
            {askHref && <AskGenAiFund href={askHref} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export { EventPage };
