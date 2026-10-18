"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAppForm } from "@/components/form/app-form";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { chooseSolutionOffers, type Solution } from "@/lib/api/generated";

import { OfferPicker } from "./offer-picker";
import { limits } from "./solution-editor-state";

/**
 * The offers a solution that was sent for review comes with, as an operator chooses them. Its owners
 * choose them in their editor; this is for a solution whose owners do not, such as one GenAI Fund
 * published for a partner. The card and the page of the solution show the change at once.
 */
function SolutionOffersChoice({
  solution,
}: {
  solution: Pick<Solution, "id" | "name" | "organizationId" | "offers">;
}) {
  const t = useTranslations("Admin.solutions.offers");
  const notify = useNotify();
  const router = useRouter();
  const form = useAppForm({
    defaultValues: { offers: solution.offers },
    onSubmit: async ({ value }) => {
      try {
        await chooseSolutionOffers({
          path: { id: solution.id },
          body: { offerIds: value.offers.map((offer) => offer.id) },
        });
        notify.success("Admin.solutions.offers.saved", { name: solution.name });
        router.refresh();
      } catch (error) {
        notify.failure(error);
      }
    },
  });

  return (
    <form
      id={form.formId}
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      aria-labelledby="solution-offers-choice"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="solution-offers-choice" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      <form.Field name="offers">
        {(field) => (
          <Field>
            <FieldLabel htmlFor="solution-offers-choice-field">{t("field")}</FieldLabel>
            <OfferPicker
              id="solution-offers-choice-field"
              solutionId={solution.id}
              organizationId={solution.organizationId}
              value={field.state.value}
              onValueChange={field.handleChange}
              operator
              aria-describedby="solution-offers-choice-hint"
            />
            <FieldDescription id="solution-offers-choice-hint">
              {t("hint", { max: limits.offers })}
            </FieldDescription>
          </Field>
        )}
      </form.Field>
      <form.AppForm>
        <form.SubmitButton prominence="secondary" className="self-start">
          {t("save")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

export { SolutionOffersChoice };
