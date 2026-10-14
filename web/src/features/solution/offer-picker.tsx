"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { TextButton } from "@/components/actions/text-button";
import { useNotify } from "@/hooks/use-notify";
import { listSolutionOffers, type Offer } from "@/lib/api/generated";

import { CodeCombobox } from "./code-combobox";
import { OfferDialog } from "./offer-dialog";
import { limits } from "./solution-editor-state";

type OfferPickerProps = {
  id: string;
  /** The solution the offers are chosen for: it is given GenAI Fund's list and its organization's own. */
  solutionId: string;
  /** The offers the solution comes with. */
  value: Offer[];
  onValueChange: (offers: Offer[]) => void;
  /**
   * True for an operator, whose new offer joins GenAI Fund's list. A member's new offer is their
   * organization's own.
   */
  operator?: boolean;
  "aria-describedby"?: string;
};

/**
 * The offers a solution comes with: those of the list GenAI Fund keeps, marked as its own, and those
 * the solution's organization wrote. Whoever chooses also writes a new one from here. The picker
 * reads the list itself: it is drawn by the editor of a solution wherever that opens, and by the
 * operators' page of one.
 */
function OfferPicker({
  id,
  solutionId,
  value,
  onValueChange,
  operator = false,
  "aria-describedby": describedBy,
}: OfferPickerProps) {
  const t = useTranslations("Solution.offers.picker");
  const notify = useNotify();
  const [listed, setListed] = useState<Offer[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let current = true;
    listSolutionOffers({ query: { solutionId } }).then(
      ({ data }) => {
        if (current) {
          setListed(data);
        }
      },
      (error) => {
        if (current) {
          notify.failure(error);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [notify, solutionId]);

  // What the solution already comes with is offered before the list has answered, and after an
  // offer left it.
  const options = [
    ...listed,
    ...value.filter((chosen) => !listed.some((offer) => offer.id === chosen.id)),
  ];

  // A closed offer a solution keeps is chosen by no other, which its label says.
  const label = (offer: Offer) => {
    const named = offer.fromGenAiFund ? t("fromGenAiFund", { title: offer.title }) : offer.title;
    return offer.closed ? t("closed", { title: named }) : named;
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <CodeCombobox
        id={id}
        options={options.map((offer) => ({
          value: offer.id,
          label: label(offer),
        }))}
        value={value.map((offer) => offer.id)}
        onValueChange={(ids) =>
          onValueChange(ids.flatMap((chosen) => options.find((offer) => offer.id === chosen) ?? []))
        }
        placeholder={t("placeholder")}
        emptyLabel={t("noMatch")}
        removeLabel={(name) => t("remove", { name })}
        max={limits.offers}
        truncateOptionLabels
        aria-describedby={describedBy}
      />
      <TextButton size="sm" onClick={() => setAdding(true)}>
        <PlusIcon aria-hidden="true" />
        {t("add")}
      </TextButton>
      <OfferDialog
        open={adding}
        onOpenChange={setAdding}
        own={!operator}
        onSaved={(added) => {
          setListed((current) => [...current, added]);
          // The offer was written for this solution, so it is chosen while there is room.
          if (value.length < limits.offers) {
            onValueChange([...value, added]);
          }
        }}
      />
    </div>
  );
}

export { OfferPicker };
