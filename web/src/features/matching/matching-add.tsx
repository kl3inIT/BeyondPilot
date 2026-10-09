"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/actions/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useVocabulary } from "@/i18n/vocabulary";
import { listAdminSolutions, type AdminSolutionSummary } from "@/lib/api/generated";

/** The longest search the backend takes. */
const MAX_SEARCH = 100;

type MatchingAddProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The solutions that are on the list already, which cannot be added again. */
  candidateSolutionIds: string[];
  /** The solution a request is on its way for. */
  pendingId: string | null;
  /** Adds the solution; answers whether it was added, so the dialog closes only then. */
  onAdd: (solution: AdminSolutionSummary) => Promise<boolean>;
};

/**
 * An operator's way to add a solution the AI did not find: a search over the approved solutions by
 * name or organization, and one click on the one to add. The run that follows reads it. The dialog is
 * opened from the "More" menu of the page.
 */
function MatchingAdd({
  open,
  onOpenChange,
  candidateSolutionIds,
  pendingId,
  onAdd,
}: MatchingAddProps) {
  const t = useTranslations("Matching.add");
  const maturityName = useVocabulary("maturity");
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<AdminSolutionSummary[] | null>(null);
  const [failed, setFailed] = useState(false);

  // The search asks 300 ms after the last keystroke; an answer to an older question is dropped.
  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await listAdminSolutions({
          query: { q: query.trim().slice(0, MAX_SEARCH) || undefined, status: "approved", page: 1 },
        });
        if (current) {
          setFound(data.items);
          setFailed(false);
        }
      } catch {
        if (current) {
          setFound([]);
          setFailed(true);
        }
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <Dialog open={open} onOpenChange={(next) => (pendingId ? undefined : onOpenChange(next))}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={searchId}>{t("search")}</FieldLabel>
          <Input
            id={searchId}
            type="search"
            autoComplete="off"
            maxLength={MAX_SEARCH}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
        <div aria-live="polite" className="flex max-h-80 flex-col overflow-y-auto">
          {found === null && <p className="py-3 text-sm text-muted-foreground">{t("searching")}</p>}
          {found?.length === 0 && (
            <p className="py-3 text-sm text-muted-foreground">{t(failed ? "failed" : "empty")}</p>
          )}
          {found && found.length > 0 && (
            <ul className="flex flex-col">
              {found.map((solution) => {
                const already = candidateSolutionIds.includes(solution.id);
                return (
                  <li
                    key={solution.id}
                    className="flex items-center gap-3 border-b py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{solution.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[
                          solution.organizationName,
                          solution.maturity && maturityName(solution.maturity),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {already ? (
                      <span className="shrink-0 text-sm text-muted-foreground">{t("already")}</span>
                    ) : (
                      <Button
                        prominence="secondary"
                        size="sm"
                        aria-label={t("addNamed", { name: solution.name })}
                        pending={pendingId === solution.id}
                        disabled={pendingId !== null}
                        onClick={() =>
                          void onAdd(solution).then((added) => {
                            if (added) {
                              onOpenChange(false);
                            }
                          })
                        }
                      >
                        {t("add")}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            prominence="secondary"
            disabled={pendingId !== null}
            onClick={() => onOpenChange(false)}
          >
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { MatchingAdd };
