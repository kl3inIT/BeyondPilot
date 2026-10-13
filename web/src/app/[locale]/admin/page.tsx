import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminHomePage } from "@/features/admin-home/admin-home-page";
import { readUsageOverview } from "@/features/ai/usage-queries";
import { readEmailActivity } from "@/features/email/email-queries";
import { readAdminOrganizations } from "@/features/organization/organization-queries";
import { readReviewPrograms } from "@/features/review/review-queries";
import { readSearchIndex } from "@/features/search/admin-ai-queries";
import { readAdminSolutions } from "@/features/solution/solution-queries";
import { readAdminTalentList } from "@/features/talent/talent-queries";
import { readAdminUseCases } from "@/features/usecase/admin-use-case-queries";
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
 * figure is read from the list or the page it leads to, so the two always agree.
 */
export default async function AdminHomeRoute({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.admin);
  const [organizations, solutions, talent, useCases, programs, usage, email, index] =
    await Promise.all([
      readAdminOrganizations({
        q: "",
        status: "in_review",
        country: null,
        sort: "",
        page: 1,
        size: null,
      }),
      readAdminSolutions({
        q: "",
        organizationId: null,
        status: "in_review",
        industry: null,
        featured: null,
        sort: "",
        page: 1,
        size: null,
      }),
      readAdminTalentList({
        q: "",
        status: "in_review",
        featured: null,
        sort: "",
        page: 1,
        size: null,
      }),
      readAdminUseCases({
        q: "",
        status: "in_review",
        organization: null,
        featured: null,
        sort: "",
        page: 1,
        size: null,
      }),
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
      waiting={{
        useCases: useCases.inReview,
        solutions: solutions.total,
        talent: talent.total,
        organizations: organizations.total,
        deployments: solutions.deploymentsAwaitingReview,
      }}
      programs={programs.items}
      usage={usage}
      email={email.counts}
      index={index}
    />
  );
}
