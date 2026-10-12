"use client";

import { Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { IconButton } from "@/components/actions/icon-button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
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
  ids: string[];
  onIds: (ids: string[]) => void;
  approach: string;
  onApproach: (approach: string) => void;
  /** Whether to say what is missing, once the person tried to go on. */
  checked: boolean;
};

/**
 * The solutions of the organization the proposal offers, as cards,
 * and how they solve the use case. Solutions are added from a popup; a new one is written in the
 * editor, in a dialog over this page.
 */
function ProposalSolutionsStep({
  catalog,
  organizationLogoFileId,
  onCatalog,
  ids,
  onIds,
  approach,
  onApproach,
  checked,
}: ProposalSolutionsStepProps) {
  const t = useTranslations("UseCaseProposal.wizard.solutions");
  const format = useFormatter();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const rows = ids.flatMap((id) => catalog.find((solution) => solution.id === id) ?? []);
  const noApproach = checked && approach.trim() === "";

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
        onIds(addSolutions(ids, [created]));
      }
    } catch {
      // The list is read again the next time the popup opens.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          {rows.length > 0 ? (
            <p className="text-sm text-muted-foreground">{t("count", { count: rows.length })}</p>
          ) : (
            <span />
          )}
          <Button prominence="secondary" onClick={() => setPicking(true)}>
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
                  onClick={() => onIds(removeSolution(ids, solution.id))}
                >
                  <Trash2Icon aria-hidden="true" />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {checked && ids.length === 0 && (
          <p role="alert" className="text-sm text-destructive">
            {t("needed.solution")}
          </p>
        )}
      </div>

      <Field data-invalid={noApproach || undefined}>
        <FieldLabel htmlFor="proposal-approach">{t("approach")}</FieldLabel>
        <Textarea
          id="proposal-approach"
          rows={5}
          maxLength={maxApproach}
          value={approach}
          aria-invalid={noApproach || undefined}
          onChange={(event) => onApproach(event.target.value)}
        />
        <div className="flex items-start justify-between gap-3">
          <span />
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {format.number(approach.length)} / {format.number(maxApproach)}
          </span>
        </div>
        {noApproach && <FieldError>{t("needed.approach")}</FieldError>}
      </Field>

      <ProposalSolutionPicker
        open={picking}
        onOpenChange={setPicking}
        chosen={ids}
        known={catalog}
        organizationLogoFileId={organizationLogoFileId}
        onPick={(picked, all) => {
          onCatalog(all);
          onIds(picked);
        }}
        onCreated={(id) => {
          setPicking(false);
          setEditing(id);
        }}
      />
      <ProposalSolutionEditorDialog solutionId={editing} onClose={() => void closeEditor()} />
    </div>
  );
}

export { ProposalSolutionsStep };
