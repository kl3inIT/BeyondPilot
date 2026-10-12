"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { RequiredMark } from "@/components/composites/required-mark";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotify } from "@/hooks/use-notify";
import { ApiError } from "@/lib/api/client";
import {
  createOffer,
  createOwnOffer,
  saveOffer,
  saveOwnOffer,
  type AdminOffer,
  type Offer,
} from "@/lib/api/generated";

import { solutionError } from "./solution-errors";

/** The limits the backend sets, repeated so a person meets them before a round trip. */
const TITLE_MAX = 80;
const URL_MAX = 2048;

/** An offer is claimed at an https address and no other: a card links to it straight away. */
const httpsAddress = /^https:\/\/\S+$/;

type OfferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The offer to change; none for a new one. */
  offer?: Pick<AdminOffer, "id" | "title" | "url" | "version"> &
    Partial<Pick<AdminOffer, "organizationId">>;
  /**
   * True where a member writes an offer of their organization, which only its solutions come with.
   * Without it the offer is of GenAI Fund's list, which an operator writes.
   */
  own?: boolean;
  /** Called with the offer as the backend keeps it. */
  onSaved: (offer: Pick<Offer, "id" | "title" | "url" | "fromGenAiFund">) => void;
};

/**
 * An offer, new or changed: the line a card says and the address where it is claimed. An operator
 * writes GenAI Fund's list, a member the offers of their own organization. A change shows at once
 * on every solution that comes with the offer.
 */
function OfferDialog({ open, onOpenChange, offer, own = false, onSaved }: OfferDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        {/* Drawn with the dialog, so each opening starts from the offer as it is now. */}
        <OfferForm offer={offer} own={own} onSaved={onSaved} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OfferForm({
  offer,
  own,
  onSaved,
  onClose,
}: Pick<OfferDialogProps, "offer" | "onSaved"> & { own: boolean; onClose: () => void }) {
  const t = useTranslations("Solution.offers.form");
  const notify = useNotify();
  const [title, setTitle] = useState(offer?.title ?? "");
  const [url, setUrl] = useState(offer?.url ?? "");
  const [tried, setTried] = useState(false);
  const [pending, setPending] = useState(false);
  // The title another offer already has, so the field says so until it is changed.
  const [taken, setTaken] = useState<string | null>(null);

  const noTitle = tried && !title.trim();
  const titleTaken = taken !== null && taken === title.trim();
  const badUrl = tried && !httpsAddress.test(url.trim());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // The dialog can open over the editor of a solution, whose own form must not take this submission.
    event.stopPropagation();
    setTried(true);
    if (!title.trim() || !httpsAddress.test(url.trim())) {
      return;
    }
    setPending(true);
    try {
      const body = { title: title.trim(), url: url.trim(), version: offer?.version ?? null };
      const { data } = offer
        ? own
          ? await saveOwnOffer({ path: { id: offer.id }, body })
          : await saveOffer({ path: { id: offer.id }, body })
        : own
          ? await createOwnOffer({ body })
          : await createOffer({ body });
      notify.success(offer ? "Solution.offers.done.saved" : "Solution.offers.done.created", {
        name: data.title,
      });
      onSaved({
        id: data.id,
        title: data.title,
        url: data.url,
        fromGenAiFund: !own && !offer?.organizationId,
      });
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === "SOLUTION_OFFER_TITLE_TAKEN") {
        setTaken(title.trim());
      } else {
        notify.error(solutionError(error));
      }
      setPending(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t(offer ? "editTitle" : "newTitle")}</DialogTitle>
      </DialogHeader>
      <Field data-invalid={noTitle || titleTaken || undefined}>
        <FieldLabel htmlFor="offer-title">
          {t("title")}
          <RequiredMark />
        </FieldLabel>
        <Input
          id="offer-title"
          maxLength={TITLE_MAX}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-required
          aria-invalid={noTitle || titleTaken || undefined}
        />
        {noTitle && <FieldError>{t("titleRequired")}</FieldError>}
        {titleTaken && <FieldError>{t("titleTaken")}</FieldError>}
        <span className="self-end text-xs text-muted-foreground tabular-nums">
          {t("counter", { count: title.length, max: TITLE_MAX })}
        </span>
      </Field>
      <Field data-invalid={badUrl || undefined}>
        <FieldLabel htmlFor="offer-url">
          {t("url")}
          <RequiredMark />
        </FieldLabel>
        <Input
          id="offer-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          maxLength={URL_MAX}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-required
          aria-invalid={badUrl || undefined}
        />
        {badUrl && <FieldError>{t("urlInvalid")}</FieldError>}
      </Field>
      <DialogFooter>
        <Button prominence="secondary" disabled={pending} onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit" size="lg" pending={pending}>
          {t(offer ? "save" : "create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

export { OfferDialog };
