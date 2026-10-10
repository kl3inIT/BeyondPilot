"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { backSolution, type Solution } from "@/lib/api/generated";

import { solutionError } from "./solution-errors";

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
  const [held, setHeld] = useState({
    backedBy: solution.backing?.backedBy ?? "",
    program: solution.backing?.program ?? "",
    funding: solution.backing?.funding ?? "",
  });
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await backSolution({
        path: { id: solution.id },
        body: {
          backedBy: held.backedBy.trim() || null,
          program: held.program.trim() || null,
          funding: held.funding.trim() || null,
        },
      });
      notify.success("Admin.solutions.backing.saved", { name: solution.name });
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
      aria-labelledby="solution-backing"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="solution-backing" className="text-base font-semibold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      {fields.map((field) => (
        <Field key={field}>
          <FieldLabel htmlFor={`solution-backing-${field}`}>{t(`fields.${field}`)}</FieldLabel>
          <Input
            id={`solution-backing-${field}`}
            maxLength={MAX}
            value={held[field]}
            onChange={(event) =>
              setHeld((current) => ({ ...current, [field]: event.target.value }))
            }
            aria-describedby={`solution-backing-${field}-hint`}
          />
          <FieldDescription id={`solution-backing-${field}-hint`}>
            {t(`hints.${field}`)}
          </FieldDescription>
        </Field>
      ))}
      <FieldDescription>{t("hint")}</FieldDescription>
      <Button type="submit" prominence="secondary" pending={pending} className="self-start">
        {t("save")}
      </Button>
    </form>
  );
}

export { SolutionBacking };
