"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/actions/button";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import {
  listAdminOrganizations,
  mergeOrganization,
  type AdminOrganizationSummary,
  type Organization,
} from "@/lib/api/generated";

import { organizationError } from "./organization-errors";

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
 * Merges a duplicate organization into the one to keep, in two steps: choose the one kept, then type
 * the duplicate's name to confirm, since a merge cannot be undone. It stays open while the merge is
 * sent; whoever opened it closes it.
 */
function MergeDialog({ organization, members, invitations, onClose }: MergeDialogProps) {
  const t = useTranslations("Admin.organizations.merge");
  const notify = useNotify();
  const router = useRouter();
  const keepId = useId();
  const confirmId = useId();
  const [kept, setKept] = useState<Kept | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const candidates = useCandidates(organization.id);

  async function merge() {
    if (!kept) {
      return;
    }
    setPending(true);
    try {
      await mergeOrganization({ path: { id: organization.id }, body: { intoId: kept.id } });
      notify.success("Organization.done.merged", { name: organization.name, kept: kept.name });
      onClose();
      router.refresh();
    } catch (error) {
      notify.error(organizationError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        {confirming && kept ? (
          <>
            <DialogHeader>
              <DialogTitle size="lg">{t("confirmTitle", { kept: kept.name })}</DialogTitle>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor={confirmId}>
                {t("confirmLabel", { name: organization.name })}
              </FieldLabel>
              <Input
                id={confirmId}
                autoComplete="off"
                placeholder={organization.name}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
              <p className="text-sm text-destructive">{t("cannotUndo")}</p>
            </Field>
            <DialogFooter>
              <Button
                prominence="secondary"
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                {t("back")}
              </Button>
              <Button
                tone="danger"
                pending={pending}
                disabled={typed.trim() !== organization.name}
                onClick={merge}
              >
                {t("merge")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle size="lg">{t("title", { name: organization.name })}</DialogTitle>
              <DialogDescription>{t("lead")}</DialogDescription>
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
                <ComboboxInput id={keepId} className="w-full" placeholder={t("keepPlaceholder")} />
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
              <FieldDescription>{t("moves", { members, invitations })}</FieldDescription>
            </Field>
            <DialogFooter>
              <Button prominence="secondary" onClick={onClose}>
                {t("cancel")}
              </Button>
              <Button
                disabled={!kept}
                onClick={() => {
                  setTyped("");
                  setConfirming(true);
                }}
              >
                {t("continue")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The organizations a duplicate may merge into, asked of the operators' list as the name is typed:
 * any but the duplicate itself, and never a merged one, which the list leaves out.
 */
function useCandidates(duplicateId: string) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Kept[]>([]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await listAdminOrganizations({
          query: { q: query.trim() || undefined },
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
