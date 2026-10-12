"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { RowMenuTrigger } from "@/components/actions/row-menu-trigger";
import { ConfirmDialog } from "@/components/composites/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/use-notify";
import {
  deleteOffer,
  deleteOwnOffer,
  setOfferClosed,
  setOwnOfferClosed,
  type AdminOffer,
} from "@/lib/api/generated";

import { OfferDialog } from "./offer-dialog";

/** An offer as a list shows it: the operators' list, or an organization's own. */
type ListedOffer = Pick<AdminOffer, "id" | "title" | "url" | "version" | "solutions" | "closed"> &
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
        {/* An organization's page words its actions alone, as Add a solution above this one. */}
        {!own && <PlusIcon aria-hidden="true" />}
        {t("create")}
      </Button>
      <OfferDialog open={open} onOpenChange={setOpen} own={own} onSaved={() => router.refresh()} />
    </>
  );
}

/**
 * Closes an offer to new solutions, or opens it again. Whatever the answer, the page is read again,
 * so it says what is true now: someone may have changed the offer meanwhile.
 */
function useCloseOffer(offer: ListedOffer, own: boolean) {
  const notify = useNotify();
  const router = useRouter();

  return async function toggle() {
    const closed = !offer.closed;
    try {
      await (own ? setOwnOfferClosed : setOfferClosed)({
        path: { id: offer.id },
        body: { closed, version: offer.version },
      });
      notify.success(closed ? "Solution.offers.done.closed" : "Solution.offers.done.reopened", {
        name: offer.title,
      });
    } catch (error) {
      notify.failure(error);
    }
    router.refresh();
  };
}

/** The action on the record of an offer that closes it to new solutions, or opens it again. */
function CloseOffer({ offer, own = false }: Scope & { offer: ListedOffer }) {
  const t = useTranslations("Solution.offers.manage");
  const toggle = useCloseOffer(offer, own);

  return (
    <Button prominence="secondary" size="lg" onClick={toggle}>
      {offer.closed ? t("actions.reopen") : t("actions.close")}
    </Button>
  );
}

/**
 * What the ⋯ menu of one offer gives: changing it, closing it to new solutions or opening it again,
 * and deleting it once no solution comes with it. Closing keeps the offer on the solutions that come
 * with it and can be undone, so it is not asked; a deleted offer is gone for good, so that is.
 */
function OfferRowMenu({ offer, own = false }: Scope & { offer: ListedOffer }) {
  const t = useTranslations("Solution.offers.manage");
  const notify = useNotify();
  const router = useRouter();
  const [asking, setAsking] = useState<"edit" | "delete" | null>(null);
  const [pending, setPending] = useState(false);
  const toggle = useCloseOffer(offer, own);

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
        <RowMenuTrigger aria-label={t("openNamed", { name: offer.title })} />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setAsking("edit")}>
              {t("actions.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggle}>
              {offer.closed ? t("actions.reopen") : t("actions.close")}
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

export { CloseOffer, CreateOffer, OfferRowMenu };
