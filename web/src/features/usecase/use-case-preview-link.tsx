"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { CopyButton } from "@/components/actions/copy-button";
import { Switch } from "@/components/ui/switch";
import { useNotify } from "@/hooks/use-notify";
import { useRouter } from "@/i18n/navigation";
import {
  setAdminUseCasePreview,
  setMyUseCasePreview,
  type UseCasePreview,
} from "@/lib/api/generated";
import { previewedUseCaseRoute } from "@/lib/site";

import { useCaseWords } from "./my-use-case-errors";

type UseCasePreviewLinkProps = {
  /** Whose call it makes: the organization's own, or the operators'. */
  area: "workspace" | "admin";
  id: string;
  preview: UseCasePreview;
};

/**
 * The read-only link to a use case that is not public: anyone holding it reads the brief without
 * signing in, and turning it off ends the link for good.
 */
function UseCasePreviewLink({ area, id, preview }: UseCasePreviewLinkProps) {
  const t = useTranslations("Organization.useCases.preview");
  const notify = useNotify();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const token = preview.token ?? null;

  async function change(enabled: boolean) {
    setPending(true);
    try {
      await (area === "admin" ? setAdminUseCasePreview : setMyUseCasePreview)({
        path: { id },
        body: { enabled },
      });
      notify.success(
        enabled ? "Organization.useCases.preview.on" : "Organization.useCases.preview.off",
      );
      router.refresh();
    } catch (error) {
      notify.failure(error, useCaseWords);
    } finally {
      setPending(false);
    }
  }

  const link = token ? `${window.location.origin}${previewedUseCaseRoute(token)}` : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1 text-sm">
          <h2 className="font-medium">{t("title")}</h2>
          <p className="max-w-prose text-muted-foreground">{t("hint")}</p>
        </div>
        <Switch
          aria-label={t("title")}
          checked={token !== null}
          disabled={pending}
          onCheckedChange={(checked) => void change(checked)}
        />
      </div>
      {link && (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link}
            aria-label={t("link")}
            onFocus={(event) => event.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-md border bg-muted/50 px-3 text-sm"
          />
          <CopyButton value={link} label={t("copy")} />
        </div>
      )}
    </section>
  );
}

export { UseCasePreviewLink };
