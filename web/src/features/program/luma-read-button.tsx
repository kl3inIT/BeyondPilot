"use client";

import { RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/actions/button";
import { useNotify } from "@/hooks/use-notify";
import { readLumaCalendar } from "@/lib/api/generated";

/**
 * Reads the GenAI Fund calendar on Luma now, for an operator who just published an event there and
 * does not want to wait for the hourly read (BEY-190). The toast says what changed.
 */
function LumaReadButton() {
  const t = useTranslations("Admin.programs.luma");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function read() {
    setPending(true);
    try {
      const { data } = await readLumaCalendar();
      notify.success("Admin.programs.luma.done", {
        created: data.created,
        updated: data.updated,
        unpublished: data.unpublished,
        failed: data.failed,
      });
      router.refresh();
    } catch (error) {
      notify.failure(error);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button prominence="secondary" pending={pending} onClick={read} title={t("hint")}>
      <RefreshCwIcon aria-hidden="true" />
      {t("read")}
    </Button>
  );
}

export { LumaReadButton };
