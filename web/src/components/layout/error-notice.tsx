"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

type ErrorNoticeProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/** What a failed page shows in its place: safe copy, Next's digest to quote, and a way to retry. */
function ErrorNotice({ error, retry }: ErrorNoticeProps) {
  const t = useTranslations("Error");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      {error.digest ? (
        <p className="text-sm text-muted-foreground">{t("reference", { digest: error.digest })}</p>
      ) : null}
      <Button type="button" className="w-fit" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </div>
  );
}

export { ErrorNotice };
export type { ErrorNoticeProps };
