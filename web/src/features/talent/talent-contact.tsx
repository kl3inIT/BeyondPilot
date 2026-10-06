"use client";

import { TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { siteRoutes } from "@/lib/site";

import { TalentEnquiry } from "./talent-enquiry";

type TalentContactProps = {
  slug: string;
  /** The person the card leads to, as their profile names them. */
  name: string;
  /** Whether the person takes on work, already worded; the bar on a phone shows it under the name. */
  availability?: string;
  /** True when the person says they are not looking for work; they can still be written to. */
  notAvailable: boolean;
  /** When the caller's message to the person was sent, while it waits for their answer. */
  waitingSince?: string | null;
  /** Where a visitor signs in to write to the person; absent for someone signed in, who writes here. */
  signInHref?: string;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
  /** Whether the person takes on work and how, under the title. */
  intro?: React.ReactNode;
  /** The facts about the person and the note on how an enquiry travels, under the actions. */
  children: React.ReactNode;
};

/**
 * "Work with …": the one way to open a conversation with the person. A visitor is sent to sign in
 * first; a sender whose message waits is told so instead; the owner of the profile gets the way to
 * edit it. On a phone the action stays in reach in a bar at the foot of the screen.
 */
function TalentContact({
  slug,
  name,
  availability,
  notAvailable,
  waitingSince,
  signInHref,
  own,
  intro,
  children,
}: TalentContactProps) {
  const t = useTranslations("Talent.enquiry");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const waiting = !own && Boolean(waitingSince);
  const idle = !own && !waiting;
  // A visitor's button is the link to sign in; a signed-in person's opens the message.
  const opens = signInHref ? { href: signInHref } : { onClick: () => setOpen(true) };

  return (
    <>
      <section
        aria-labelledby="talent-contact"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:p-6"
      >
        <h2 id="talent-contact" className="font-medium">
          {t("title", { name })}
        </h2>
        {intro}
        {own && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">{t("ownLead")}</p>
            <Button
              prominence="secondary"
              size="lg"
              className="w-full"
              href={siteRoutes.talentProfile}
            >
              {t("ownEdit")}
            </Button>
          </div>
        )}
        {waiting && waitingSince && (
          <Alert>
            <TimerIcon aria-hidden="true" />
            <AlertTitle>{t("waitingTitle", { name })}</AlertTitle>
            <AlertDescription>
              {t("waitingLead", {
                date: format.dateTime(new Date(waitingSince), { dateStyle: "medium" }),
              })}
            </AlertDescription>
          </Alert>
        )}
        {idle && (
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" {...opens}>
              {t("open", { name })}
            </Button>
            {signInHref && (
              <p className="text-xs text-muted-foreground">{t("signInLead", { name })}</p>
            )}
          </div>
        )}
        <Separator />
        {children}
      </section>
      {idle && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-lg md:hidden">
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold">{name}</span>
            {availability && <span className="text-xs text-muted-foreground">{availability}</span>}
          </div>
          <Button size="lg" {...opens}>
            {t("openShort")}
          </Button>
        </div>
      )}
      {!signInHref && idle && (
        <TalentEnquiry
          slug={slug}
          name={name}
          notAvailable={notAvailable}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

export { TalentContact };
