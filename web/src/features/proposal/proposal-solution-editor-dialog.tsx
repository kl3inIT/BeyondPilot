"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { SolutionEditor } from "@/features/solution/solution-editor";
import { solutionError } from "@/features/solution/solution-errors";
import { useNotify } from "@/hooks/use-notify";
import { getMySolution, type Solution } from "@/lib/api/generated";

type ProposalSolutionEditorDialogProps = {
  /** The draft just created, whose editor opens; null while none is. */
  solutionId: string | null;
  /** Called when the person leaves the editor, however they do it. */
  onClose: () => void;
};

/**
 * The editor of a solution over the proposal: the same four steps as on the solution's own page, in a
 * dialog that nearly fills the screen, so the person comes back to the proposal where they left it.
 */
function ProposalSolutionEditorDialog({ solutionId, onClose }: ProposalSolutionEditorDialogProps) {
  const t = useTranslations("UseCaseProposal.wizard.solutions");
  const notify = useNotify();
  const [loaded, setLoaded] = useState<Solution | null>(null);
  const solution = loaded && loaded.id === solutionId ? loaded : null;

  useEffect(() => {
    if (!solutionId) {
      return;
    }
    let current = true;
    getMySolution({ path: { id: solutionId } }).then(
      ({ data }) => {
        if (current) {
          setLoaded(data);
        }
      },
      (error) => {
        if (current) {
          notify.error(solutionError(error));
          onClose();
        }
      },
    );
    return () => {
      current = false;
    };
  }, [solutionId, notify, onClose]);

  return (
    <Dialog open={solutionId !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent
        showCloseButton={false}
        className="inset-4 flex translate-x-0 translate-y-0 flex-col overflow-y-auto sm:max-w-none"
      >
        <DialogTitle className="sr-only">{t("editorTitle")}</DialogTitle>
        <DialogDescription className="sr-only">{t("editorLead")}</DialogDescription>
        {solution ? (
          <SolutionEditor key={solution.id} solution={solution} onLeave={onClose} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground">
            <Spinner />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { ProposalSolutionEditorDialog };
