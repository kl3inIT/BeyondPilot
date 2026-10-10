"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { GiveMatchingFeedback, MatchingCandidate } from "@/lib/api/generated";

import { groups, othersAnswered, type Need } from "./matching-view";

/** Where a solution may belong: one of the three groups, or none of them. */
const places = [...groups, "none"] as const satisfies MatchingCandidate["bucket"][];

type Place = (typeof places)[number];

const MAX_NOTE = 500;

type MatchingFeedbackProps = {
  candidate: Pick<MatchingCandidate, "bucket" | "feedback" | "feedbackCount" | "disagreeCount">;
  /** What the use case asks for; with more than one, the reader may say which the AI got wrong. */
  needs: Need[];
  /** True while the answer is on its way. */
  pending: boolean;
  /** Sends the answer; resolves to whether it was kept. */
  onAnswer: (body: GiveMatchingFeedback) => Promise<boolean>;
};

/**
 * One question about a solution the AI has read: is this the right group? Yes is one press. No opens,
 * in place, the group it belongs in, the requirements the AI got wrong and a note, the last two if the
 * reader wants. What was answered is said back with a way to change it. The answer moves nothing in
 * the list: it tells GenAI Fund how well the AI judges. An operator also reads how many people
 * answered when someone else did.
 */
function MatchingFeedback({ candidate, needs, pending, onAnswer }: MatchingFeedbackProps) {
  const t = useTranslations("Matching");
  const whereId = useId();
  const noteId = useId();
  const boxId = useId();
  /** Answering again, or saying where the solution belongs; otherwise what was answered stands. */
  const [step, setStep] = useState<"rest" | "again" | "where">("rest");
  const [expected, setExpected] = useState<Place | null>(null);
  const [disputed, setDisputed] = useState<number[]>([]);
  const [note, setNote] = useState("");
  // Spring answers null where there is no answer.
  const said = candidate.feedback ?? undefined;
  const others = othersAnswered(candidate);
  const placeName = (place: Place) =>
    place === "none" ? t("feedback.none") : t(`groups.${place}.title`);

  async function answer(body: GiveMatchingFeedback) {
    if (await onAnswer(body)) {
      setStep("rest");
      setExpected(null);
      setDisputed([]);
      setNote("");
    }
  }

  return (
    <section aria-label={t("feedback.question")} className="flex flex-col gap-3 border-t pt-5">
      {step === "where" ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p id={whereId} className="text-sm font-medium">
              {t("feedback.where")}
            </p>
            <ToggleGroup
              aria-labelledby={whereId}
              variant="outline"
              size="sm"
              className="w-full flex-wrap"
              value={expected ? [expected] : []}
              disabled={pending}
              onValueChange={(next) =>
                setExpected(places.find((place) => place === next[0]) ?? null)
              }
            >
              {places
                .filter((place) => place !== candidate.bucket)
                .map((place) => (
                  <ToggleGroupItem key={place} value={place} className="pointer-coarse:min-h-11">
                    {expected === place && <CheckIcon aria-hidden="true" />}
                    {placeName(place)}
                  </ToggleGroupItem>
                ))}
            </ToggleGroup>
          </div>
          {needs.length > 1 && (
            <FieldSet>
              <FieldLegend variant="label">{t("feedback.which")}</FieldLegend>
              {needs.map((need) => (
                <Field
                  key={need.position}
                  orientation="horizontal"
                  className="pointer-coarse:min-h-11"
                >
                  <Checkbox
                    id={`${boxId}-${need.position}`}
                    checked={disputed.includes(need.position)}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      setDisputed((current) =>
                        checked
                          ? [...current, need.position]
                          : current.filter((position) => position !== need.position),
                      )
                    }
                  />
                  <FieldLabel htmlFor={`${boxId}-${need.position}`}>{need.name}</FieldLabel>
                </Field>
              ))}
            </FieldSet>
          )}
          <Field>
            <FieldLabel htmlFor={noteId}>{t("feedback.note")}</FieldLabel>
            <Input
              id={noteId}
              maxLength={MAX_NOTE}
              value={note}
              disabled={pending}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              className="pointer-coarse:min-h-11"
              pending={pending}
              disabled={expected === null}
              onClick={() =>
                expected &&
                void answer({
                  agrees: false,
                  expectedBucket: expected,
                  requirements: [...disputed].sort((one, other) => one - other),
                  note: note.trim() || undefined,
                })
              }
            >
              {t("feedback.send")}
            </Button>
            <Button
              prominence="tertiary"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={pending}
              onClick={() => setStep("rest")}
            >
              {t("feedback.cancel")}
            </Button>
          </div>
        </div>
      ) : said && step === "rest" ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm">
            {said.agrees || !said.expectedBucket
              ? t("feedback.agreed")
              : t("feedback.said", { group: placeName(said.expectedBucket) })}
          </p>
          <TextButton onClick={() => setStep("again")}>{t("feedback.change")}</TextButton>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm font-medium">{t("feedback.question")}</p>
          <div className="flex items-center gap-2">
            <Button
              prominence="secondary"
              size="sm"
              className="pointer-coarse:min-h-11"
              pending={pending}
              onClick={() => void answer({ agrees: true })}
            >
              {t("feedback.yes")}
            </Button>
            <Button
              prominence="secondary"
              size="sm"
              className="pointer-coarse:min-h-11"
              disabled={pending}
              onClick={() => setStep("where")}
            >
              {t("feedback.no")}
            </Button>
          </div>
        </div>
      )}
      {others && <p className="text-xs text-muted-foreground">{t("feedback.counts", others)}</p>}
    </section>
  );
}

export { MatchingFeedback };
