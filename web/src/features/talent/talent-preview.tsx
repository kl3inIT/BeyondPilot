"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCountryName, useVocabulary } from "@/i18n/vocabulary";
import type { TalentProfile } from "@/lib/api/generated";

import { TalentPhoto } from "./talent-photo";
import { TalentView } from "./talent-view";

/**
 * The saved profile as others will read it, from the page's head. It shows what was last saved,
 * which the dialog says, so an unsaved change is not mistaken for a published one.
 */
function TalentPreview({ profile }: { profile: TalentProfile }) {
  const t = useTranslations("Talent.mine.preview");
  const role = useVocabulary("talentRole");
  const countryName = useCountryName();
  const [open, setOpen] = useState(false);
  const kind = [
    profile.roles.length > 0 && role(profile.roles[0]),
    [profile.city, profile.country && countryName(profile.country)].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Button prominence="secondary" onClick={() => setOpen(true)}>
        {t("action")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-svh overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-4">
              <TalentPhoto
                name={profile.name}
                photoFileId={profile.photoFileId}
                size={64}
                className="size-16 text-lg"
              />
              <div className="flex min-w-0 flex-col gap-1">
                <DialogTitle>{profile.name}</DialogTitle>
                {kind && <p className="text-sm text-muted-foreground">{kind}</p>}
                {profile.headline && <p>{profile.headline}</p>}
              </div>
            </div>
            <DialogDescription>{t("note")}</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <TalentView profile={profile} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { TalentPreview };
