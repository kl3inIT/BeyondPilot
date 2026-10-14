"use client";

import { ArrowUpRightIcon, SparklesIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { TextButton } from "@/components/actions/text-button";
import { usePublicSite } from "@/components/layout/use-public-site";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFormatter } from "@/i18n/format";
import { deadlineText } from "@/i18n/formats";
import { readConsent, subscribeConsent } from "@/lib/analytics-consent";
import type { ProgramKeyDate, ProgramSummary } from "@/lib/api/generated";
import { programRoute } from "@/lib/site";
import { publicFileUrl } from "@/lib/storage/upload";

/** What the announcement shows of the program an operator featured, read on the server. */
type FeaturedProgramView = Pick<
  ProgramSummary,
  "slug" | "name" | "partnerName" | "summary" | "coverFileId"
> & {
  /** When its applications close: the announcement goes then. */
  closesAt: string;
  /** Its next key date still to come, shown under the deadline. */
  next: ProgramKeyDate | null;
};

const listeners = new Set<() => void>();

/** The programs put away in this document, for a browser that refuses to store anything. */
const minimisedHere = new Set<string>();

/** What is kept per program, so a newly featured program is announced once to everyone. */
function storageKey(slug: string) {
  return `featured-program:${slug}`;
}

/** Whether the visitor has put the announcement of this program away, here or on an earlier visit. */
function readMinimised(slug: string): boolean {
  if (minimisedHere.has(slug)) {
    return true;
  }
  try {
    return window.localStorage.getItem(storageKey(slug)) === "minimised";
  } catch {
    return false;
  }
}

function minimise(slug: string) {
  minimisedHere.add(slug);
  try {
    window.localStorage.setItem(storageKey(slug), "minimised");
  } catch {
    // Private browsing or blocked site data: the answer holds for this document only.
  }
  listeners.forEach((listener) => listener());
}

function subscribeMinimised(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** Tells React once, at the deadline, so a page left open drops the announcement when it passes. */
function subscribeDeadline(deadline: string) {
  return (onChange: () => void) => {
    const wait = Date.parse(deadline) - Date.now();
    // A timer cannot wait longer than about 24 days; a visit that long reloads before then.
    if (wait <= 0 || wait > 2_000_000_000) {
      return () => {};
    }
    const timer = setTimeout(onChange, wait + 1000);
    return () => clearTimeout(timer);
  };
}

/**
 * The program GenAI Fund features on the home page: an announcement in the middle of the window on
 * a first visit, which "Maybe later" or closing puts away as a small card at the bottom right; the
 * card opens it again. A visitor who put it away once gets only the card on later visits, until
 * another program is featured.
 *
 * Its name, words, cover and dates are the program's, as an operator entered them in Admin. The page
 * is rendered ahead of time, so the browser decides the rest when it hydrates: nothing shows after
 * the program's deadline, and nothing shows while the cookie notice still waits for its answer, so
 * two things never cover the page at once.
 */
function FeaturedProgram({ program }: { program: FeaturedProgramView }) {
  const t = useTranslations("Home.featured");
  const format = useFormatter();
  const { slug, closesAt, next } = program;
  const live = usePublicSite();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  const untilDeadline = useMemo(() => subscribeDeadline(closesAt), [closesAt]);
  const closed = useSyncExternalStore(
    untilDeadline,
    () => Date.now() > Date.parse(closesAt),
    () => true,
  );
  const minimised = useSyncExternalStore(
    subscribeMinimised,
    () => readMinimised(slug),
    () => true,
  );
  const [reopened, setReopened] = useState(false);

  // The cookie notice is asked on the public address only (see Analytics).
  if (closed || (live && consent === null)) {
    return null;
  }

  const open = !minimised || reopened;
  const putAway = () => {
    minimise(slug);
    setReopened(false);
  };
  const nextDay = next ? new Date(next.startsAt) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={(opened) => (opened ? setReopened(true) : putAway())}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {program.coverFileId && (
            // The cover runs to the edges of the dialog, as its footer bar does, and shows whole.
            <div className="-mx-4 -mt-4 overflow-hidden rounded-t-xl">
              <Image
                src={publicFileUrl(program.coverFileId)}
                alt=""
                width={1600}
                height={900}
                sizes="(min-width: 640px) 28rem, 100vw"
                className="h-auto w-full"
              />
            </div>
          )}
          <DialogClose
            render={
              <IconButton
                aria-label={t("close")}
                size="sm"
                className="absolute top-3 right-3 rounded-full bg-background/90"
              />
            }
          >
            <XIcon />
          </DialogClose>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {t("eyebrow")}
            </p>
            <DialogTitle size="lg">{program.name}</DialogTitle>
            {program.partnerName && (
              <p className="text-base font-semibold">
                {t("lead", { partner: program.partnerName })}
              </p>
            )}
            {program.summary && <DialogDescription>{program.summary}</DialogDescription>}
          </div>
          <dl className="flex flex-col gap-1.5 border-y py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("deadline")}</dt>
              <dd className="font-semibold">{deadlineText(format, new Date(closesAt))}</dd>
            </div>
            {next && nextDay && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{next.title}</dt>
                <dd className="text-right font-semibold">
                  {next.allDay
                    ? format.dateTime(nextDay, "day")
                    : `${format.dateTime(nextDay, "day")}, ${format.dateTime(nextDay, "time")} ICT`}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-col items-center gap-3 pb-1">
            <Button
              size="xl"
              href={programRoute(slug)}
              onClick={() => minimise(slug)}
              className="w-full"
            >
              {t("explore")}
              <ArrowUpRightIcon aria-hidden="true" />
            </Button>
            <DialogClose render={<TextButton />}>{t("later")}</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
      {!open && (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setReopened(true)}
          className="fixed right-4 bottom-4 z-40 flex max-w-72 flex-col gap-1 rounded-xl border bg-card px-4 py-3 text-left text-card-foreground shadow-raised transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {program.name}
          </span>
          <span className="flex items-center gap-1 text-sm text-primary">
            {t("view")}
            <ArrowUpRightIcon className="size-3.5" aria-hidden="true" />
          </span>
        </button>
      )}
    </>
  );
}

export { FeaturedProgram, type FeaturedProgramView };
