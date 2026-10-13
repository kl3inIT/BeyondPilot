import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { Separator } from "@/components/ui/separator";
import { siteRoutes } from "@/lib/site";

type TalentContactProps = {
  /** The person the card leads to, as their profile names them. */
  name: string;
  /** Where Contact leads: Messages, or for a visitor the sign-in screen that returns there. */
  href: string;
  /** True when nobody is signed in: the card says that signing in comes first. */
  visitor: boolean;
  /** True when the profile is the caller's own: they edit it instead of writing to it. */
  own: boolean;
  /** The work the person takes on, under the title. */
  intro?: React.ReactNode;
  /** The facts about the person and the note on how a first message travels, under the actions. */
  children: React.ReactNode;
};

/**
 * "Work with …": the one way to open a conversation with the person, which leads to Messages with
 * the first message to write. A visitor is sent to sign in first; the owner of the profile gets the
 * way to edit it. On a phone the action stays in reach in a bar at the foot of the screen.
 */
function TalentContact({ name, href, visitor, own, intro, children }: TalentContactProps) {
  const t = useTranslations("Talent.contact");

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
        {own ? (
          <Button
            prominence="secondary"
            size="lg"
            className="w-full"
            href={siteRoutes.talentProfile}
          >
            {t("ownEdit")}
          </Button>
        ) : (
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" href={href}>
              {t("open", { name })}
            </Button>
            {visitor && (
              <p className="text-xs text-muted-foreground">{t("signInLead", { name })}</p>
            )}
          </div>
        )}
        <Separator />
        {children}
      </section>
      {!own && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-lg md:hidden">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
          <Button size="lg" href={href}>
            {t("openShort")}
          </Button>
        </div>
      )}
    </>
  );
}

export { TalentContact };
