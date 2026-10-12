"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { chooseSolutionOffers, type Solution } from "@/lib/api/generated";

import { OfferPicker } from "./offer-picker";
import { limits } from "./solution-editor-state";
import { solutionError } from "./solution-errors";

/**
 * The offers a solution that was sent for review comes with, as an operator chooses them. Its owners
 * choose them in their editor; this is for a solution whose owners do not, such as one GenAI Fund
 * published for a partner. The card and the page of the solution show the change at once.
 */
function SolutionOffersChoice({
  solution,
}: {
  solution: Pick<Solution, "id" | "name" | "offers">;
}) {
  const t = useTranslations("Admin.solutions.offers");
  const notify = useNotify();
  const router = useRouter();
  const [chosen, setChosen] = useState(solution.offers);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await chooseSolutionOffers({
        path: { id: solution.id },
        body: { offerIds: chosen.map((offer) => offer.id) },
      });
      notify.success("Admin.solutions.offers.saved", { name: solution.name });
      router.refresh();
    } catch (error) {
      notify.error(solutionError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={save}
      aria-labelledby="solution-offers-choice"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="solution-offers-choice" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <Field>
        <FieldLabel htmlFor="solution-offers-choice-field">{t("field")}</FieldLabel>
        <OfferPicker
          id="solution-offers-choice-field"
          solutionId={solution.id}
          value={chosen}
          onValueChange={setChosen}
          operator
          aria-describedby="solution-offers-choice-hint"
        />
        <FieldDescription id="solution-offers-choice-hint">
          {t("hint", { max: limits.offers })}
        </FieldDescription>
      </Field>
      <Button type="submit" prominence="secondary" pending={pending} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

export { SolutionOffersChoice };
