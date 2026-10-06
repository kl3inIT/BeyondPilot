import { ClipboardCheckIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DataTableEmpty } from "@/components/composites/data-table";
import { Badge } from "@/components/ui/badge";
import { applyFormatter } from "@/features/apply/apply-format";
import { Link } from "@/i18n/navigation";
import type { ReviewPrograms } from "@/lib/api/generated";
import { reviewProgramRoute } from "@/lib/site";

/**
 * Reviews: the programs a judge was invited to score, each with how far they are. GenAI Fund decides
 * and tells the applicants; a judge only scores.
 */
function MyReviewsPage({ programs }: { programs: ReviewPrograms }) {
  const t = useTranslations("Review.programs");
  const locale = useLocale();
  const format = applyFormatter(locale);

  return (
    <div className="flex flex-1 flex-col gap-5 px-4 pt-2 pb-12 md:px-6 lg:px-8" lang={locale}>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lead")}</p>
      </div>
      {programs.items.length === 0 ? (
        <DataTableEmpty
          icon={<ClipboardCheckIcon aria-hidden="true" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {programs.items.map((program) => (
            <li key={program.id}>
              <Link
                href={reviewProgramRoute(program.id)}
                className="flex h-full flex-col gap-2 rounded-lg border bg-card p-5 outline-none hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-medium">{program.name}</span>
                  {program.released ? (
                    <Badge variant="outline">{t("released")}</Badge>
                  ) : program.assessed >= program.applications && program.applications > 0 ? (
                    <Badge variant="success">{t("done")}</Badge>
                  ) : null}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("progress", { done: program.assessed, total: program.applications })}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("closes", { closes: format.deadline(program.closesAt) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export { MyReviewsPage };
