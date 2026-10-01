"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = useTranslations("Error");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      {error.digest ? (
        <p className="text-sm text-muted-foreground">{t("reference", { digest: error.digest })}</p>
      ) : null}
      <Button type="button" className="w-fit" onClick={() => retry()}>
        {t("retry")}
      </Button>
    </main>
  );
}
