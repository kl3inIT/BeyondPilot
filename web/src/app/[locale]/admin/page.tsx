import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminHomePage } from "@/features/admin-home/admin-home-page";
import { readUsageOverview } from "@/features/ai/usage-queries";
import { readEmailActivity } from "@/features/email/email-queries";
import { readOrganizationQueue } from "@/features/organization/organization-queries";
import { readReviewPrograms } from "@/features/review/review-queries";
import { readSearchIndex } from "@/features/search/admin-ai-queries";
import { readDeploymentQueue, readSolutionQueue } from "@/features/solution/solution-queries";
import { readTalentQueue } from "@/features/talent/talent-queries";
import { readUseCaseQueue } from "@/features/usecase/admin-use-case-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Admin home: what waits for a decision, the applications to read and the state of the system. Each
 * figure comes from the module that owns it; a queue's today is the count its list gives.
 */
export default async function AdminHomeRoute({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.admin);
  const [useCases, solutions, talent, organizations, deployments, programs, usage, email, index] =
    await Promise.all([
      readUseCaseQueue(),
      readSolutionQueue(),
      readTalentQueue(),
      readOrganizationQueue(),
      readDeploymentQueue(),
      readReviewPrograms(),
      readUsageOverview({ period: "7d", by: "model" }),
      readEmailActivity({
        period: "week",
        kind: null,
        status: null,
        q: "",
        before: null,
        after: null,
        size: null,
      }),
      readSearchIndex(),
    ]);

  return (
    <AdminHomePage
      queues={{ useCases, solutions, talent, organizations, deployments }}
      programs={programs.items}
      usage={usage}
      email={email.counts}
      index={index}
    />
  );
}
