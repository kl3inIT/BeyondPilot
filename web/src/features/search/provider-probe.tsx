"use client";

import { CircleCheckIcon, CircleXIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AiProviderTest } from "@/lib/api/generated";

/**
 * What a test of a connection found, under the Test button: the model, the dimensions and the time
 * when it worked, a fixed reason when it did not. The provider's own message is never shown.
 */
function ProbeResult({ result }: { result: AiProviderTest }) {
  const t = useTranslations("Admin.ai.probe");

  return (
    <div role="status" className="flex items-start gap-2.5 rounded-lg bg-muted p-2.5 text-sm">
      {result.ok ? (
        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <CircleXIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="font-medium">
          {result.ok
            ? t("connected", {
                model: result.model,
                dimensions: result.dimensions ?? 0,
                ms: result.latencyMs,
              })
            : t("failed", { ms: result.latencyMs })}
        </p>
        {!result.ok && result.reason && (
          <p className="text-muted-foreground">{t(`reason.${result.reason}`)}</p>
        )}
      </div>
    </div>
  );
}

export { ProbeResult };
