"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { TextButton } from "@/components/actions/text-button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { NewSolutionForm } from "@/features/solution/create-solution";
import { catalogRowProps, ProposalSolutionRow } from "./proposal-solution-list";
import { useNotify } from "@/hooks/use-notify";
import { listMySolutions, type SolutionSummary } from "@/lib/api/generated";

type ProposalSolutionPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The solutions already chosen; they show as ticked. */
  chosen: string[];
  /** The organization's solutions as the wizard last read them, shown while the list is read again. */
  known: SolutionSummary[];
  /** The organization's logo, shown for a solution that has none of its own. */
  organizationLogoFileId?: string | null;
  /** Called with the solutions to offer, in the order shown, and the list as it was read. */
  onPick: (ids: string[], solutions: SolutionSummary[]) => void;
  /** Called with a draft just created, to open its editor. */
  onCreated: (id: string) => void;
};

/**
 * The popup in which the member picks the organization's solutions for the proposal. Any solution may
 * be added, and a new one may be started from here.
 */
function ProposalSolutionPicker({ open, onOpenChange, ...rest }: ProposalSolutionPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton={false}>
        <PickerBody onOpenChange={onOpenChange} {...rest} />
      </DialogContent>
    </Dialog>
  );
}

type PickerBodyProps = Omit<ProposalSolutionPickerProps, "open">;

/** The content of the popup; it is made each time the popup opens, so it starts from what is chosen. */
function PickerBody({
  onOpenChange,
  chosen,
  known,
  organizationLogoFileId,
  onPick,
  onCreated,
}: PickerBodyProps) {
  const t = useTranslations("UseCaseProposal.wizard.solutions.pick");
  const tCreate = useTranslations("Solution.mine.create");
  const notify = useNotify();
  const [items, setItems] = useState<SolutionSummary[]>(known);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(chosen);
  const [naming, setNaming] = useState(false);

  // The list is read again each time the popup opens.
  useEffect(() => {
    let current = true;
    listMySolutions().then(
      ({ data }) => {
        if (current) {
          setItems(data.items);
          setLoading(false);
        }
      },
      (error: unknown) => {
        if (current) {
          notify.failure(error);
          setLoading(false);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [notify]);

  const toggle = (id: string, ticked: boolean) =>
    setSelected((current) => (ticked ? [...current, id] : current.filter((other) => other !== id)));
  const unchanged =
    selected.length === chosen.length && selected.every((id) => chosen.includes(id));

  function confirm() {
    // What was chosen keeps its place; what is new follows.
    const ordered = [
      ...chosen.filter((id) => selected.includes(id)),
      ...selected.filter((id) => !chosen.includes(id)),
    ];
    onPick(ordered, items);
    onOpenChange(false);
  }

  // Naming a new solution takes the popup's place, so there is never a popup over a popup.
  if (naming) {
    return <NewSolutionForm onCancel={() => setNaming(false)} onCreated={onCreated} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle size="lg">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("lead")}</DialogDescription>
      </DialogHeader>
      <div className="max-h-96 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex justify-center p-6 text-sm">
            {loading ? <Spinner /> : <span className="text-muted-foreground">{t("empty")}</span>}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((solution) => (
              <li key={solution.id} className="flex items-center gap-3">
                <Checkbox
                  aria-label={t("choose", { name: solution.name })}
                  checked={selected.includes(solution.id)}
                  onCheckedChange={(next) => toggle(solution.id, next === true)}
                />
                <div className="min-w-0 flex-1">
                  <ProposalSolutionRow {...catalogRowProps(solution, organizationLogoFileId)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        {t("note")}
        <TextButton onClick={() => setNaming(true)}>{tCreate("title")}</TextButton>
      </p>
      <DialogFooter>
        <Button prominence="secondary" onClick={() => onOpenChange(false)}>
          {t("cancel")}
        </Button>
        <Button disabled={unchanged} onClick={confirm}>
          {t("add", { count: selected.length })}
        </Button>
      </DialogFooter>
    </>
  );
}

export { ProposalSolutionPicker };
