"use client";

import { EllipsisIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import { deleteOffer, deleteOwnOffer, type AdminOffer } from "@/lib/api/generated";

import { OfferDialog } from "./offer-dialog";

/** An offer as a list shows it: the operators' list, or an organization's own. */
type ListedOffer = Pick<AdminOffer, "id" | "title" | "url" | "version" | "solutions"> &
  Partial<Pick<AdminOffer, "organizationId">>;

type Scope = {
  /**
   * True on an organization's own page, where its members write its offers. Without it the list is
   * the operators', and a new offer joins GenAI Fund's.
   */
  own?: boolean;
};

/** The action that adds an offer to the list. */
function CreateOffer({ own = false }: Scope) {
  const t = useTranslations("Solution.offers.manage");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="lg" onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden="true" />
        {t("create")}
      </Button>
      <OfferDialog open={open} onOpenChange={setOpen} own={own} onSaved={() => router.refresh()} />
    </>
  );
}

/**
 * What the ⋯ menu of one offer gives: changing it, and deleting it once no solution comes with it. A
 * deleted offer is gone for good, so the deletion is asked once.
 */
function OfferRowMenu({ offer, own = false }: Scope & { offer: ListedOffer }) {
  const t = useTranslations("Solution.offers.manage");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<"edit" | "delete" | null>(null);
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      await (own ? deleteOwnOffer : deleteOffer)({ path: { id: offer.id } });
      notify.success("Solution.offers.done.deleted", { name: offer.title });
      setAsking(null);
      router.refresh();
    } catch (error) {
      notify.failure(error);
      setAsking(null);
      // Someone chose it or changed it meanwhile: the list says what is true now.
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("openNamed", { name: offer.title })}
              className="hit-area flex size-8 shrink-0 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
            />
          }
        >
          <EllipsisIcon className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setAsking("edit")}>
              {t("actions.edit")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              disabled={offer.solutions > 0}
              onClick={() => setAsking("delete")}
            >
              {t("actions.delete")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <OfferDialog
        open={asking === "edit"}
        onOpenChange={(next) => setAsking(next ? "edit" : null)}
        offer={offer}
        own={own}
        onSaved={() => router.refresh()}
      />
      <ConfirmDialog
        open={asking === "delete"}
        onOpenChange={(next) => setAsking(next ? "delete" : null)}
        title={t("confirmDelete.title", { name: offer.title })}
        description={t("confirmDelete.lead")}
        confirmLabel={t("confirmDelete.confirm")}
        cancelLabel={t("confirmDelete.cancel")}
        tone="danger"
        pending={pending}
        onConfirm={remove}
      />
    </>
  );
}

export { CreateOffer, OfferRowMenu };
