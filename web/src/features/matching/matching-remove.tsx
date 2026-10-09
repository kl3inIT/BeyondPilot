"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SolutionLogo } from "@/features/solution/solution-logo";
import type { MatchingCandidate, RemoveMatchingCandidate } from "@/lib/api/generated";

/** Why a candidate is removed, in the order the picker offers the reasons. */
const reasons = [
  "does_not_solve",
  "wrong_industry_or_size",
  "closed_or_wrong_website",
  "duplicate",
  "other",
] as const satisfies RemoveMatchingCandidate["reason"][];

const MAX_NOTE = 500;

type MatchingRemoveProps = {
  candidate: Pick<MatchingCandidate, "solutionName" | "logoFileId">;
  pending: boolean;
  onCancel: () => void;
  onRemove: (body: RemoveMatchingCandidate) => void;
};

/**
 * Asks why a candidate is not a fit, in the place of its row: one reason out of five and a note if the
 * person wants. "Other" needs the note, since nothing else says what the reason is.
 */
function MatchingRemove({ candidate, pending, onCancel, onRemove }: MatchingRemoveProps) {
  const t = useTranslations("Matching.remove");
  const titleId = useId();
  const [reason, setReason] = useState<RemoveMatchingCandidate["reason"] | null>(null);
  const [note, setNote] = useState("");
  const noteNeeded = reason === "other" && note.trim() === "";

  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 rounded-xl border bg-muted p-4"
    >
      <div className="flex items-center gap-3">
        <SolutionLogo
          name={candidate.solutionName}
          fileId={candidate.logoFileId}
          size="card"
          className="size-7 rounded-md text-xs"
        />
        <h4 id={titleId} className="min-w-0 flex-1 text-sm font-semibold">
          {t("title", { name: candidate.solutionName })}
        </h4>
        <Button prominence="tertiary" size="sm" disabled={pending} onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
      <ToggleGroup
        aria-labelledby={titleId}
        variant="outline"
        size="sm"
        className="w-full flex-wrap"
        value={reason ? [reason] : []}
        disabled={pending}
        onValueChange={(next) =>
          setReason(reasons.find((candidateReason) => candidateReason === next[0]) ?? null)
        }
      >
        {reasons.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {reason === value && <CheckIcon aria-hidden="true" />}
            {t(`reasons.${value}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Input
        aria-label={t(reason === "other" ? "noteNeeded" : "note")}
        placeholder={t(reason === "other" ? "noteNeeded" : "note")}
        maxLength={MAX_NOTE}
        value={note}
        disabled={pending}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-xs text-muted-foreground">{t("foot")}</p>
        <Button
          size="sm"
          pending={pending}
          disabled={reason === null || noteNeeded}
          onClick={() => reason && onRemove({ reason, note: note.trim() || undefined })}
        >
          {t("confirm")}
        </Button>
      </div>
    </section>
  );
}

export { MatchingRemove };
