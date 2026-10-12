"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { useAppForm } from "@/components/form/app-form";
import { FieldDescription } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import { backSolution, type Solution } from "@/lib/api/generated";

/** The longest line the backend takes. */
const MAX = 120;

const fields = ["backedBy", "program", "funding"] as const;

/**
 * What GenAI Fund says of a solution beside its owners' words: who backs its company, the programme
 * it was selected for and its funding. An operator writes the three lines; the solution's card and
 * page show them marked as GenAI Fund's. A line left empty is taken away.
 */
function SolutionBacking({ solution }: { solution: Pick<Solution, "id" | "name" | "backing"> }) {
  const t = useTranslations("Admin.solutions.backing");
  const notify = useNotify();
  const router = useRouter();
  const form = useAppForm({
    defaultValues: {
      backedBy: solution.backing?.backedBy ?? "",
      program: solution.backing?.program ?? "",
      funding: solution.backing?.funding ?? "",
    },
    onSubmit: async ({ value }) => {
      try {
        await backSolution({
          path: { id: solution.id },
          body: {
            backedBy: value.backedBy.trim() || null,
            program: value.program.trim() || null,
            funding: value.funding.trim() || null,
          },
        });
        notify.success("Admin.solutions.backing.saved", { name: solution.name });
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
      aria-labelledby="solution-backing"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="solution-backing" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      {fields.map((name) => (
        <form.AppField key={name} name={name}>
          {(field) => (
            <field.TextField
              label={t(`fields.${name}`)}
              maxLength={MAX}
              description={t(`hints.${name}`)}
            />
          )}
        </form.AppField>
      ))}
      <FieldDescription>{t("hint")}</FieldDescription>
      <form.AppForm>
        <form.SubmitButton prominence="secondary" className="self-start">
          {t("save")}
        </form.SubmitButton>
      </form.AppForm>
    </form>
  );
}

export { SolutionBacking };
