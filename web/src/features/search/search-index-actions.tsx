"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { Button } from "@/components/actions/button";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import {
  rebuildSearchIndex,
  retrySearchEmbeddings,
  setSemanticSearch,
  type SearchIndexHeldBack,
} from "@/lib/api/generated";

import { aiError } from "./admin-ai-errors";

/**
 * Turns semantic search on or off. Off, search matches keywords and calls no provider; without a
 * usable provider the switch is off and cannot be turned on.
 */
function SemanticSwitch({
  enabled,
  available,
  settingsVersion,
}: {
  enabled: boolean;
  /** Whether a provider and model are set, so semantic search can run when on. */
  available: boolean;
  settingsVersion: number;
}) {
  const t = useTranslations("Admin.searchIndex.semantic");
  const notify = useNotify();
  const router = useRouter();
  const id = useId();
  const [pending, setPending] = useState(false);

  async function change(next: boolean) {
    setPending(true);
    try {
      await setSemanticSearch({ body: { enabled: next, version: settingsVersion } });
      notify.success(next ? "Admin.searchIndex.done.on" : "Admin.searchIndex.done.off");
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {t("switch")}
      </label>
      <Switch
        id={id}
        checked={available && enabled}
        disabled={pending || (!available && !enabled)}
        onCheckedChange={change}
      />
    </div>
  );
}

/** Rebuilds the index from what the modules publish now, and says what it did. */
function RebuildIndex({ wide }: { wide?: boolean }) {
  const t = useTranslations("Admin.searchIndex");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function rebuild() {
    setPending(true);
    try {
      const { data } = await rebuildSearchIndex();
      const run = data.lastRebuild;
      notify.success("Admin.searchIndex.done.rebuilt", {
        saved: run?.saved ?? 0,
        removed: run?.removed ?? 0,
      });
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      prominence="secondary"
      pending={pending}
      onClick={rebuild}
      className={wide ? "w-full" : undefined}
    >
      {t("rebuild")}
    </Button>
  );
}

/** Lets one held-back item, or every one, be embedded at the next run of the job. */
function RetryEmbeddings({ item, wide }: { item?: SearchIndexHeldBack; wide?: boolean }) {
  const t = useTranslations("Admin.searchIndex.heldBack");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function retry() {
    setPending(true);
    try {
      const { data } = await retrySearchEmbeddings({
        body: { kind: item?.kind, itemId: item?.itemId },
      });
      notify.success("Admin.searchIndex.done.retried", { count: data.count });
      router.refresh();
    } catch (error) {
      notify.error(aiError(error));
    } finally {
      setPending(false);
    }
  }

  return item ? (
    <Button
      prominence="tertiary"
      size="sm"
      pending={pending}
      aria-label={t("retryOne", { title: item.title })}
      onClick={retry}
    >
      {t("retry")}
    </Button>
  ) : (
    <Button
      prominence="secondary"
      size="sm"
      pending={pending}
      onClick={retry}
      className={wide ? "w-full" : undefined}
    >
      {t("retryAll")}
    </Button>
  );
}

export { RebuildIndex, RetryEmbeddings, SemanticSwitch };
