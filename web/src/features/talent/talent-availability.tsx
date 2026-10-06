import { Status } from "@/components/composites/status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { PublicTalent } from "@/lib/api/generated";

const tones = { available: "success", open_to_offers: "info", not_available: "neutral" } as const;

/** Whether a person takes on work, as a dot and its words. */
function TalentAvailability({
  availability,
}: {
  availability: NonNullable<PublicTalent["availability"]>;
}) {
  const word = useVocabulary("availability");
  return <Status tone={tones[availability]}>{word(availability)}</Status>;
}

export { TalentAvailability };
