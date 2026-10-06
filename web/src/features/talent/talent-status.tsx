import { Status } from "@/components/composites/status";
import { useVocabulary } from "@/i18n/vocabulary";
import type { TalentProfile } from "@/lib/api/generated";

const tones = {
  draft: "neutral",
  submitted: "warning",
  approved: "success",
  changes_requested: "warning",
  removed: "destructive",
} as const;

/** Where a talent profile stands with GenAI Fund, as a dot and its word. */
function TalentStatus({ status }: { status: TalentProfile["status"] }) {
  const word = useVocabulary("talentStatus");
  return <Status tone={tones[status]}>{word(status)}</Status>;
}

export { TalentStatus };
