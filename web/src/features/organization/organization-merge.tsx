"use client";

import { useStore } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { useAppForm } from "@/components/form/app-form";
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
 * sent; whoever opened it closes it. Both steps are one form, drawn by hand because the second
 * takes the first one's place in the open dialog.
 */
function MergeDialog({ organization, members, invitations, onClose }: MergeDialogProps) {
  const t = useTranslations("Admin.organizations.merge");
  const notify = useNotify();
  const router = useRouter();
  const keepId = useId();
  const [confirming, setConfirming] = useState(false);
  const candidates = useCandidates(organization.id);

  const form = useAppForm({
    defaultValues: { kept: null as Kept | null, typed: "" },
    onSubmit: async ({ value: { kept } }) => {
      if (!kept) {
        return;
      }
      try {
        await mergeOrganization({ path: { id: organization.id }, body: { intoId: kept.id } });
        notify.success("Organization.done.merged", { name: organization.name, kept: kept.name });
        onClose();
        router.refresh();
      } catch (error) {
        notify.error(organizationError(error));
      }
    },
  });
  const kept = useStore(form.store, (state) => state.values.kept);
  const typed = useStore(form.store, (state) => state.values.typed);
  const pending = useStore(form.store, (state) => state.isSubmitting);

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <form
          id={form.formId}
          noValidate
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            // Only the second step merges: Enter in the search of the first sends nothing.
            if (confirming) {
              void form.handleSubmit();
            }
          }}
        >
          {confirming && kept ? (
            <>
              <DialogHeader>
                <DialogTitle size="lg">{t("confirmTitle", { kept: kept.name })}</DialogTitle>
              </DialogHeader>
              <form.AppField name="typed">
                {(field) => (
                  <field.TextField
                    label={t("confirmLabel", { name: organization.name })}
                    autoComplete="off"
                    description={<span className="text-destructive">{t("cannotUndo")}</span>}
                  />
                )}
              </form.AppField>
              <DialogFooter>
                <Button
                  prominence="secondary"
                  disabled={pending}
                  onClick={() => setConfirming(false)}
                >
                  {t("back")}
                </Button>
                <Button
                  type="submit"
                  tone="danger"
                  pending={pending}
                  disabled={typed.trim() !== organization.name}
                >
                  {t("merge")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle size="lg">{t("title", { name: organization.name })}</DialogTitle>
              </DialogHeader>
              <form.Field name="kept">
                {(field) => (
                  <Field>
                    <FieldLabel htmlFor={keepId}>{t("keep")}</FieldLabel>
                    <Combobox
                      items={candidates.items(field.state.value)}
                      filter={null}
                      value={field.state.value}
                      onValueChange={(next: Kept | null) => field.handleChange(next)}
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
                    <FieldDescription>{t("moves", { members, invitations })}</FieldDescription>
                  </Field>
                )}
              </form.Field>
              <DialogFooter>
                <Button prominence="secondary" onClick={onClose}>
                  {t("cancel")}
                </Button>
                <Button
                  disabled={!kept}
                  onClick={() => {
                    form.setFieldValue("typed", "");
                    setConfirming(true);
                  }}
                >
                  {t("continue")}
                </Button>
              </DialogFooter>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The organizations a duplicate may merge into, asked of the operators' list as the name is typed:
 * the approved ones that are shown, but the duplicate itself.
 */
function useCandidates(duplicateId: string) {
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Kept[]>([]);

  useEffect(() => {
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const { data } = await listAdminOrganizations({
          query: { q: query.trim() || undefined, status: "approved" },
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
