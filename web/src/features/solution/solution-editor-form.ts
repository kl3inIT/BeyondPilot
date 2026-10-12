import { useState } from "react";

import { useAppForm } from "@/components/form/app-form";
import type { Solution } from "@/lib/api/generated";

import { held, type SolutionDraft } from "./solution-editor-state";

/**
 * The form of the solution editor: the draft under `solution`, so that a field's name, which is its
 * control's id, cannot meet the same name on the page that holds the editor in a dialog. The steps
 * take it to bind their fields. `onFieldChange` hears the member of the draft a person changed.
 *
 * It has no validators and no submit: a draft saves itself whenever it can be saved, and what a
 * review needs is asked for step by step (`draftSchema`), not on every field at once.
 */
export function useSolutionForm(
  solution: Solution,
  onFieldChange: (field: keyof SolutionDraft) => void,
) {
  // The editor keeps what it holds whatever the page reads again, so the start is taken once.
  const [initial] = useState(() => ({ solution: held(solution) }));
  return useAppForm({
    defaultValues: initial,
    listeners: {
      onChange: ({ fieldApi }) =>
        onFieldChange(String(fieldApi.name).replace(/^solution\./, "") as keyof SolutionDraft),
    },
  });
}

export type SolutionForm = ReturnType<typeof useSolutionForm>;
