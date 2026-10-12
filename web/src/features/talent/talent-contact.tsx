"use client";

import { TimerIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { siteRoutes } from "@/lib/site";

import { TalentEnquiry } from "./talent-enquiry";

type TalentContactProps = {
  slug: string;
  /** The person the card leads to, as their profile names them. */
  name: string;
  /** When the caller's message to the person was sent, while it waits for their answer. */
  waitingSince?: string | null;
  /** Where a visitor signs in to write to the person; absent for someone signed in, who writes here. */
  signInHref?: string;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
  /** The caller's name as their account holds it, to sign a message with; empty when it has none. */
  senderName?: string;
  /** The work the person takes on, under the title. */
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
  waitingSince,
  signInHref,
  own,
  senderName = "",
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
      <Card size="lg" role="region" aria-labelledby="talent-contact">
        <CardHeader>
          <CardTitle>
            <h2 id="talent-contact">{t("title", { name })}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {intro}
            {own && (
              <Button
                prominence="secondary"
                size="lg"
                className="w-full"
                href={siteRoutes.talentProfile}
              >
                {t("ownEdit")}
              </Button>
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
            {waiting && (
              <Button
                prominence="secondary"
                size="lg"
                className="w-full"
                href={siteRoutes.talentSent}
              >
                {t("seeSent")}
              </Button>
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
          </div>
        </CardContent>
      </Card>
      {idle && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-lg md:hidden">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
          <Button size="lg" {...opens}>
            {t("openShort")}
          </Button>
        </div>
      )}
      {!signInHref && idle && (
        <TalentEnquiry
          slug={slug}
          name={name}
          senderName={senderName}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

export { TalentContact };
