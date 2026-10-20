"use client";

import { Columns3Icon, ListIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useRouter } from "@/i18n/navigation";

import { receivedViews, type ReceivedView } from "./received-proposals";

type ReceivedViewSwitchProps = {
  view: ReceivedView;
  /** Where each view opens, the tab kept. */
  hrefs: Record<ReceivedView, string>;
};

/**
 * List or Compare, as one control of two parts on a sunken track, the way Matched solutions switches
 * between List and One by one. The view is the `?view=` of the address, so it is kept on a reload.
 */
function ReceivedViewSwitch({ view, hrefs }: ReceivedViewSwitchProps) {
  const t = useTranslations("UseCaseProposal.received.view");
  const router = useRouter();

  return (
    <ToggleGroup
      aria-label={t("label")}
      variant="segmented"
      size="sm"
      spacing={0.5}
      value={[view]}
      onValueChange={(next) => {
        const picked = receivedViews.find((name) => name === next[0]);
        if (picked && picked !== view) {
          router.replace(hrefs[picked], { scroll: false });
        }
      }}
    >
      {receivedViews.map((name) => {
        const Icon = name === "compare" ? Columns3Icon : ListIcon;
        return (
          <ToggleGroupItem key={name} value={name} className="pointer-coarse:min-h-11">
            <Icon aria-hidden="true" />
            {t(name)}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

export { ReceivedViewSwitch };
