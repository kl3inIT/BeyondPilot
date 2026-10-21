"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useNotify } from "@/hooks/use-notify";
import {
  listAdminOrganizations,
  mergeOrganization,
  type AdminOrganizationSummary,
  type Organization,
} from "@/lib/api/generated";

/** How long typing rests before the list of organizations is asked again, in milliseconds. */
const SEARCH_DELAY = 250;

type Kept = Pick<AdminOrganizationSummary, "id" | "name">;

type MergeDialogProps = {
  organization: Pick<Organization, "id" | "name">;
  /** How many people and open invitations move with it. */
  members: number;
  invitations: number;
  onClose: () => void;
};

/**
 * Merges a duplicate organization into the one to keep, in two steps: choose the one kept, then one
 * confirmation that names both and what the merge does, since it cannot be undone. The confirmation
 * stays open while the merge is sent; whoever opened the dialog closes it.
 */
function MergeDialog({ organization, members, invitations, onClose }: MergeDialogProps) {
  const t = useTranslations("Admin.organizations.merge");
  const notify = useNotify();
  const router = useRouter();
  const keepId = useId();
  const [kept, setKept] = useState<Kept | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const candidates = useCandidates(organization.id);
  const moves = t("moves", { members, invitations });

  async function merge(into: Kept) {
    setPending(true);
    try {
      await mergeOrganization({ path: { id: organization.id }, body: { intoId: into.id } });
      notify.success("Organization.done.merged", { name: organization.name, kept: into.name });
      onClose();
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  if (confirming && kept) {
    return (
      <ConfirmDialog
        open
        onOpenChange={(open) => !open && onClose()}
        title={t("confirmTitle", { name: organization.name, kept: kept.name })}
        description={moves}
        note={t("confirmNote", { name: organization.name })}
        confirmLabel={t("merge")}
        cancelLabel={t("cancel")}
        tone="danger"
        pending={pending}
        onConfirm={() => void merge(kept)}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle size="lg">{t("title", { name: organization.name })}</DialogTitle>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={keepId}>{t("keep")}</FieldLabel>
          <Combobox
            items={candidates.items(kept)}
            filter={null}
            value={kept}
            onValueChange={(next: Kept | null) => setKept(next)}
            onInputValueChange={candidates.search}
            itemToStringLabel={(item: Kept) => item.name}
            isItemEqualToValue={(item: Kept, other: Kept) => item.id === other.id}
          >
            <ComboboxInput
              id={keepId}
              className="w-full"
              placeholder={t("keepPlaceholder")}
              showTrigger={false}
            />
            <ComboboxContent>
              <ComboboxEmpty>{t("noMatch")}</ComboboxEmpty>
              <ComboboxList aria-label={t("keep")}>
                {(item: Kept) => (
                  <ComboboxItem key={item.id} value={item}>
                    {item.name}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <FieldDescription>{moves}</FieldDescription>
        </Field>
        <DialogFooter>
          <Button prominence="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button disabled={!kept} onClick={() => setConfirming(true)}>
            {t("continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The organizations a duplicate may merge into, asked of the operators' list as the name is typed:
 * the active ones that are shown, but the duplicate itself.
 */
function useCandidates(duplicateId: string) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Kept[]>([]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await listAdminOrganizations({
          query: { q: query.trim() || undefined, status: "active" },
        });
        if (current) {
          setFound(data.items.filter((item) => item.id !== duplicateId));
        }
      } catch {
        // A failed search leaves the list as it was; the operator types again.
      }
    }, SEARCH_DELAY);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, duplicateId]);

  return {
    search: setQuery,
    /** The organizations found, with the chosen one kept in so its name stays shown. */
    items: (kept: Kept | null) =>
      kept && !found.some((item) => item.id === kept.id) ? [kept, ...found] : found,
  };
}

export { MergeDialog };
