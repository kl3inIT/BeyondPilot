"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { TalentForm } from "@/features/talent/talent-form";
import type { TalentProfile } from "@/lib/api/generated";

import { ProfileRows } from "./proposal-sender-card";

type ProposalProfileStepProps = {
  /** The caller's talent profile, or none yet. */
  profile: TalentProfile | null;
  /** Whether the profile goes with the proposal. */
  attached: boolean;
  onAttach: (attached: boolean) => void;
  /** Whether the form of a new profile is open in place of the step. */
  creating: boolean;
  onCreating: (creating: boolean) => void;
  /** A sent proposal keeps what it was sent with. */
  locked: boolean;
  /** The name of the caller's account, to start a profile with. */
  accountName: string;
  onLeave: () => void;
};

/**
 * The talent profile is optional: the person chooses their profile to send it with the proposal, or makes one here,
 * and nothing of it shows until they do.
 */
function ProposalProfileStep({
  profile,
  attached,
  onAttach,
  creating,
  onCreating,
  locked,
  accountName,
  onLeave,
}: ProposalProfileStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.profile");

  if (creating) {
    return (
      <TalentForm
        // A saved profile gets a fresh form, so it holds the new version.
        key={profile ? `${profile.version}-${profile.status}` : "new"}
        profile={profile}
        suggestedName={accountName}
        embedded={{
          onBack: () => onCreating(false),
          onLeave,
          onContinue: () => {
            onCreating(false);
            onAttach(true);
          },
        }}
      />
    );
  }

  if (attached && profile) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border p-4">
        <ProfileRows profile={profile} />
        {!locked && (
          <TextButton className="self-start" onClick={() => onAttach(false)}>
            {t("remove")}
          </TextButton>
        )}
      </div>
    );
  }

  if (locked) {
    return <p className="text-sm text-muted-foreground">{t("none")}</p>;
  }

  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed p-8">
      {profile ? (
        <Button prominence="secondary" onClick={() => onAttach(true)}>
          {t("use")}
        </Button>
      ) : (
        <Button prominence="secondary" onClick={() => onCreating(true)}>
          {t("create")}
        </Button>
      )}
    </div>
  );
}

export { ProposalProfileStep };
