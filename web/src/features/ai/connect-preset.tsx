"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";

import type { ChatPreset } from "./chat-presets";
import { ProviderDialog } from "./provider-dialog";

/** The Connect button of a provider that can be added, and the dialog it opens. */
function ConnectPreset({ preset }: { preset: ChatPreset }) {
  const t = useTranslations("Admin.ai.chat.add");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        prominence="secondary"
        size="sm"
        aria-label={t("connectLabel", { name: preset.name })}
        onClick={() => setOpen(true)}
      >
        {t("connect")}
      </Button>
      {/* Mounted while open, so each connection starts from the preset and no typed key outlives it. */}
      {open && <ProviderDialog open onOpenChange={setOpen} preset={preset} />}
    </>
  );
}

export { ConnectPreset };
