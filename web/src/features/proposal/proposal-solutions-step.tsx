"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { PdfUpload, type PdfFile } from "@/components/composites/pdf-upload";
import { withFieldGroup } from "@/components/form/app-form";
import { useFieldValidity } from "@/components/form/form-context";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { listMySolutions, type SolutionSummary } from "@/lib/api/generated";

import { addSolutions, maxApproach, removeSolution } from "./proposal-draft";
import { ProposalSolutionEditorDialog } from "./proposal-solution-editor-dialog";
import { ProposalSolutionPicker } from "./proposal-solution-picker";
import { catalogHref, catalogRowProps, ProposalSolutionRow } from "./proposal-solution-list";

type ProposalSolutionsStepProps = {
  /** What the organization offers, as it was last read. */
  catalog: SolutionSummary[];
  /** The organization's logo, shown for a solution that has none of its own. */
  organizationLogoFileId?: string | null;
  onCatalog: (solutions: SolutionSummary[]) => void;
};

/**
 * The solutions of the organization the proposal offers, as cards,
 * and how they solve the use case. Solutions are added from a popup; a new one is written in the
 * editor, in a dialog over this page.
 */
const ProposalSolutionsStep = withFieldGroup({
  defaultValues: { solutionIds: [] as string[], approach: "", deck: null as PdfFile | null },
  props: { catalog: [], onCatalog: () => undefined } as ProposalSolutionsStepProps,
  render: function ProposalSolutionsStepRender({ group, ...solutions }) {
    const t = useTranslations("UseCaseProposal.wizard.solutions");
    return (
      <div className="flex flex-col gap-6">
        <group.AppField name="solutionIds">
          {() => <ChosenSolutions {...solutions} />}
        </group.AppField>
        <group.AppField name="approach">
          {(field) => (
            <field.TextareaField label={t("approach")} rows={10} maxLength={maxApproach} />
          )}
        </group.AppField>
        <group.AppField name="deck">{() => <DeckField />}</group.AppField>
      </div>
    );
  },
});

/** The proposal as a PDF. The upload marks no control as the one in error, so its button is found by id. */
function DeckField() {
  const t = useTranslations("UseCaseProposal.wizard.solutions");
  const { field, invalid, errors, ids } = useFieldValidity<PdfFile | null>();

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor="proposal-deck">{t("deck")}</FieldLabel>
      <PdfUpload
        id="proposal-deck"
        zone
        value={field.state.value}
        invalid={invalid}
        describedBy={invalid ? ids.error : undefined}
        onChange={field.handleChange}
      />
      {invalid && <FieldError id={ids.error} errors={errors} />}
    </Field>
  );
}

/** The solutions chosen, with the popup that adds to them and the editor of a new one. */
function ChosenSolutions({
  catalog,
  organizationLogoFileId,
  onCatalog,
}: ProposalSolutionsStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.solutions");
  const { field, invalid, errors, ids: fieldIds } = useFieldValidity<string[]>();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const ids = field.state.value;
  const rows = ids.flatMap((id) => catalog.find((solution) => solution.id === id) ?? []);
  const errorId = fieldIds.error;

  async function closeEditor() {
    const created = editing;
    setEditing(null);
    if (!created) {
      return;
    }
    try {
      const { data } = await listMySolutions();
      onCatalog(data.items);
      // A draft deleted in the editor is gone, and so is not offered.
      if (data.items.some((solution) => solution.id === created)) {
        field.handleChange(addSolutions(ids, [created]));
      }
    } catch {
      // The list is read again the next time the popup opens.
    }
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {rows.length > 0 ? (
            <p className="text-sm text-muted-foreground">{t("count", { count: rows.length })}</p>
          ) : (
            <span />
          )}
          <Button
            prominence="secondary"
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onClick={() => setPicking(true)}
          >
            {t("add")}
          </Button>
        </div>
        {rows.length === 0 ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((solution) => (
              <li key={solution.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <ProposalSolutionRow
                    {...catalogRowProps(solution, organizationLogoFileId)}
                    href={catalogHref(solution)}
                  />
                </div>
                <IconButton
                  prominence="tertiary"
                  size="sm"
                  aria-label={t("remove", { name: solution.name })}
                  onClick={() => field.handleChange(removeSolution(ids, solution.id))}
                >
                  <Trash2Icon aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {invalid && <FieldError id={errorId} errors={errors} />}
      </div>

      <ProposalSolutionPicker
        open={picking}
        onOpenChange={setPicking}
        chosen={ids}
        known={catalog}
        organizationLogoFileId={organizationLogoFileId}
        onPick={(picked, all) => {
          onCatalog(all);
          field.handleChange(picked);
        }}
        onCreated={(id) => {
          setPicking(false);
          setEditing(id);
        }}
      />
      <ProposalSolutionEditorDialog solutionId={editing} onClose={() => void closeEditor()} />
    </>
  );
}

export { ProposalSolutionsStep };
