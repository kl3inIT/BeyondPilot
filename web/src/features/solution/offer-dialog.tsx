"use client";

import { revalidateLogic } from "@tanstack/react-form";
import { useTranslations } from "next-intl";

import { FormDialog } from "@/components/composites/form-dialog";
import { setServerErrors, useAppForm } from "@/components/form/app-form";
import { useNotify } from "@/hooks/use-notify";
import { failedWith } from "@/lib/api/failure";
import {
  createOffer,
  createOwnOffer,
  saveOffer,
  saveOwnOffer,
  type AdminOffer,
  type Offer,
} from "@/lib/api/generated";

import { offerLimits, offerSchema } from "./solution-schemas";

type OfferDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The offer to change; none for a new one. */
  offer?: Pick<AdminOffer, "id" | "title" | "url" | "version"> &
    Partial<Pick<AdminOffer, "organizationId" | "closed">>;
  /**
   * True where a member writes an offer of their organization, which only its solutions come with.
   * Without it the offer is of GenAI Fund's list, which an operator writes.
   */
  own?: boolean;
  /** Called with the offer as the backend keeps it. */
  onSaved: (offer: Pick<Offer, "id" | "title" | "url" | "fromGenAiFund" | "closed">) => void;
};

/**
 * An offer, new or changed: the line a card says and the address where it is claimed. An operator
 * writes GenAI Fund's list, a member the offers of their own organization. A change shows at once
 * on every solution that comes with the offer.
 */
function OfferDialog({ open, onOpenChange, offer, own = false, onSaved }: OfferDialogProps) {
  const t = useTranslations("Solution.offers.form");
  const say = useTranslations("Form.errors");
  const notify = useNotify();
  const schema = offerSchema(say, t("urlInvalid"));

  const form = useAppForm({
    // The offer as the list holds it now, which each opening starts from.
    defaultValues: { title: offer?.title ?? "", url: offer?.url ?? "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: schema },
    onSubmit: async ({ value, formApi }) => {
      try {
        const body = { ...schema.parse(value), version: offer?.version ?? null };
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
          closed: offer?.closed ?? false,
        });
        onOpenChange(false);
      } catch (error) {
        // The backend keeps titles apart; its refusal is said where the title is typed.
        if (failedWith(error, "SOLUTION_OFFER_TITLE_TAKEN")) {
          setServerErrors(formApi, { fields: { title: { message: t("titleTaken") } } });
        } else {
          notify.failure(error);
        }
      }
    },
  });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      form={form}
      title={t(offer ? "editTitle" : "newTitle")}
      submitLabel={t(offer ? "save" : "create")}
      cancelLabel={t("cancel")}
    >
      <form.AppField name="title">
        {(field) => (
          <field.TextField
            label={t("title")}
            requiredMark
            autoComplete="off"
            maxLength={offerLimits.title}
          />
        )}
      </form.AppField>
      <form.AppField name="url">
        {(field) => (
          <field.TextField
            label={t("url")}
            requiredMark
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={offerLimits.url}
          />
        )}
      </form.AppField>
    </FormDialog>
  );
}

export { OfferDialog };
