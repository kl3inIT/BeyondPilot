"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/actions/button";
import { DataTable } from "@/components/composites/data-table";
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
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreateSolution } from "@/features/solution/create-solution";
import {
  SolutionListingCell,
  SolutionNameCell,
  SolutionReviewCell,
} from "@/features/solution/solution-row-cells";
import { useNotify } from "@/hooks/use-notify";
import { listMySolutions, type SolutionSummary } from "@/lib/api/generated";

type ProposalSolutionPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The solutions already chosen; they show as ticked. */
  chosen: string[];
  /** The organization's solutions as the wizard last read them, shown while the list is read again. */
  known: SolutionSummary[];
  /** Called with the solutions to offer, in the order shown, and the list as it was read. */
  onPick: (ids: string[], solutions: SolutionSummary[]) => void;
  /** Called with a draft just created, to open its editor. */
  onCreated: (id: string) => void;
};

/**
 * The popup in which the member picks the organization's solutions for the proposal. Any solution may
 * be added, whatever its review says, and a new one may be started from here.
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
function PickerBody({ onOpenChange, chosen, known, onPick, onCreated }: PickerBodyProps) {
  const t = useTranslations("UseCaseProposal.wizard.solutions.pick");
  const columns = useTranslations("Solution.mine.columns");
  const notify = useNotify();
  const [items, setItems] = useState<SolutionSummary[]>(known);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(chosen);

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
      () => {
        if (current) {
          notify.error("UseCaseProposal.errors.unknown");
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

  return (
    <>
      <DialogHeader>
        <DialogTitle size="lg">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("lead")}</DialogDescription>
      </DialogHeader>
      <div className="max-h-96 overflow-y-auto">
        <DataTable>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">{t("select")}</span>
              </TableHead>
              <TableHead>{columns("solution")}</TableHead>
              <TableHead className="w-36">{columns("status")}</TableHead>
              <TableHead className="w-44">{columns("listing")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((solution) => (
              <TableRow key={solution.id}>
                <TableCell>
                  <Checkbox
                    aria-label={t("choose", { name: solution.name })}
                    checked={selected.includes(solution.id)}
                    onCheckedChange={(next) => toggle(solution.id, next === true)}
                  />
                </TableCell>
                <TableCell className="max-w-0">
                  <SolutionNameCell solution={solution} />
                </TableCell>
                <TableCell>
                  <SolutionReviewCell solution={solution} />
                </TableCell>
                <TableCell>
                  <SolutionListingCell solution={solution} />
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center">
                  {loading ? (
                    <Spinner />
                  ) : (
                    <span className="text-muted-foreground">{t("empty")}</span>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </DataTable>
      </div>
      <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
        {t("note")}
        <CreateSolution onCreated={onCreated} />
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
