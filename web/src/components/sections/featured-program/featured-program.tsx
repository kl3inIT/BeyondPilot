"use client";

import { ArrowUpRightIcon, SparklesIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

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
import { readConsent, subscribeConsent } from "@/lib/analytics-consent";
import { featuredProgramDeadline, featuredProgramSlug, programRoute } from "@/lib/site";

const storageKey = `featured-program:${featuredProgramSlug}`;
const listeners = new Set<() => void>();

/** The answer given in this document, for a browser that refuses to store anything. */
let minimisedHere = false;

/** Whether the visitor has put the announcement away, in this document or on an earlier visit. */
function readMinimised(): boolean {
  if (minimisedHere) {
    return true;
  }
  try {
    return window.localStorage.getItem(storageKey) === "minimised";
  } catch {
    return false;
  }
}

function minimise() {
  minimisedHere = true;
  try {
    window.localStorage.setItem(storageKey, "minimised");
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
function subscribeDeadline(onChange: () => void) {
  const wait = Date.parse(featuredProgramDeadline) - Date.now();
  // A timer cannot wait longer than about 24 days; a visit that long reloads before then.
  if (wait <= 0 || wait > 2_000_000_000) {
    return () => {};
  }
  const timer = setTimeout(onChange, wait + 1000);
  return () => clearTimeout(timer);
}

/**
 * The program GenAI Fund features on the home page: an announcement in the middle of the window on
 * a first visit, which "Maybe later" or closing puts away as a small card at the bottom right; the
 * card opens it again. A visitor who put it away once gets only the card on later visits.
 *
 * The page is rendered ahead of time, so the browser decides everything when it hydrates: nothing
 * shows after the program's deadline, and nothing shows while the cookie notice still waits for its
 * answer, so two things never cover the page at once.
 */
function FeaturedProgram() {
  const t = useTranslations("Home.featured");
  const live = usePublicSite();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, () => null);
  const closed = useSyncExternalStore(
    subscribeDeadline,
    () => Date.now() > Date.parse(featuredProgramDeadline),
    () => true,
  );
  const minimised = useSyncExternalStore(subscribeMinimised, readMinimised, () => true);
  const [reopened, setReopened] = useState(false);

  // The cookie notice is asked on the public address only (see Analytics).
  if (closed || (live && consent === null)) {
    return null;
  }

  const open = !minimised || reopened;
  const putAway = () => {
    minimise();
    setReopened(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? setReopened(true) : putAway())}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {/* The photograph runs to the edges of the dialog, as its footer bar does. */}
          <div className="-mx-4 -mt-4 overflow-hidden rounded-t-xl">
            <Image
              src="/programs/nestle/building.webp"
              alt={t("imageAlt")}
              width={880}
              height={550}
              sizes="(min-width: 640px) 28rem, 100vw"
              className="h-auto w-full"
            />
          </div>
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
            <DialogTitle size="lg">{t("name")}</DialogTitle>
            <p className="text-base font-semibold">{t("lead")}</p>
            <DialogDescription>{t("text")}</DialogDescription>
          </div>
          <dl className="flex flex-col gap-1.5 border-y py-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("early")}</dt>
              <dd className="font-semibold">{t("earlyValue")}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("deadline")}</dt>
              <dd className="font-semibold">{t("deadlineValue")}</dd>
            </div>
          </dl>
          <div className="flex flex-col items-center gap-3 pb-1">
            <Button
              size="xl"
              href={programRoute(featuredProgramSlug)}
              onClick={minimise}
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
          className="fixed right-4 bottom-4 z-40 flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 text-left text-card-foreground shadow-raised transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <SparklesIcon className="size-4 text-primary" aria-hidden="true" />
            {t("widget")}
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

export { FeaturedProgram };
