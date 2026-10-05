"use client";

import { CircleCheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { siteRoutes } from "@/lib/site";

import { TalentEnquiry, type EnquiryTopic } from "./talent-enquiry";

type TalentContactProps = {
  slug: string;
  /** The person the card leads to, as their profile names them. */
  name: string;
  /** Whether the person takes on work, already worded; the bar on a phone shows it under the name. */
  availability?: string;
  /** Where a visitor signs in to write to the person; absent for someone signed in, who writes here. */
  signInHref?: string;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
  /** The facts about the person and the note on how an enquiry travels, under the actions. */
  children: React.ReactNode;
};

/**
 * "Work with …": the two ways to open a conversation with the person, both of which end in a
 * message. A visitor is sent to sign in first; the owner of the profile gets the way to edit it. On
 * a phone the first action stays in reach in a bar at the foot of the screen.
 */
function TalentContact({
  slug,
  name,
  availability,
  signInHref,
  own,
  children,
}: TalentContactProps) {
  const t = useTranslations("Talent.enquiry");
  const [topic, setTopic] = useState<EnquiryTopic | null>(null);
  const [sent, setSent] = useState(false);
  const idle = !own && !sent && topic === null;
  // A visitor's button is the link to sign in; a signed-in person's opens the message.
  const opens = (chosen: EnquiryTopic) =>
    signInHref ? { href: signInHref } : { onClick: () => setTopic(chosen) };

  return (
    <>
      <section
        aria-labelledby="talent-contact"
        className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm md:p-6"
      >
        <h2 id="talent-contact" className="font-medium">
          {t("title", { name })}
        </h2>
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
        {sent && (
          <Alert>
            <CircleCheckIcon aria-hidden="true" />
            <AlertTitle>{t("sentTitle", { name })}</AlertTitle>
            <AlertDescription>{t("sentLead")}</AlertDescription>
          </Alert>
        )}
        {!sent && topic !== null && (
          <TalentEnquiry
            slug={slug}
            name={name}
            topic={topic}
            onSent={() => setSent(true)}
            onCancel={() => setTopic(null)}
          />
        )}
        {idle && (
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full max-md:hidden" {...opens("project")}>
              {t("project")}
            </Button>
            <Button prominence="secondary" size="lg" className="w-full" {...opens("role")}>
              {t("role")}
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
          <Button size="lg" {...opens("project")}>
            {t("project")}
          </Button>
        </div>
      )}
    </>
  );
}

export { TalentContact };
