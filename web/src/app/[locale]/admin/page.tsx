import { BoxesIcon, BuildingIcon, RocketIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminPageHeader } from "@/components/layout/admin-page-header";
import { readAdminOrganizations } from "@/features/organization/organization-queries";
import { readAdminSolutions } from "@/features/solution/solution-queries";
import { readAdminTalentList } from "@/features/talent/talent-queries";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Admin home: what waits for a decision, each count a way to its list, already narrowed. A queue with
 * nothing in it stays a way to its list and reads quieter, so the eye lands on the ones that wait.
 */
export default async function AdminHomeRoute({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.admin);
  const t = await getTranslations("Admin");
  const [organizations, solutions, talent] = await Promise.all([
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
  ]);
  const queues = [
    {
      key: "organizations" as const,
      Icon: BuildingIcon,
      href: `${siteRoutes.adminOrganizations}?status=in_review`,
      count: organizations.total,
    },
    {
      key: "solutions" as const,
      Icon: BoxesIcon,
      href: `${siteRoutes.adminSolutions}?status=in_review`,
      count: solutions.total,
    },
    {
      key: "talent" as const,
      Icon: UsersIcon,
      href: `${siteRoutes.adminTalent}?status=in_review`,
      count: talent.total,
    },
    {
      // A deployment is reviewed on its solution; the list puts the solutions holding one first.
      key: "deployments" as const,
      Icon: RocketIcon,
      href: siteRoutes.adminSolutions,
      count: solutions.deploymentsAwaitingReview,
    },
  ];
  const waiting = queues.reduce((sum, queue) => sum + queue.count, 0);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <AdminPageHeader
        destination="home"
        title={t("title")}
        lead={t("home.lead", { count: waiting })}
      />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {queues.map((queue) => (
          <li key={queue.key}>
            <Link
              href={queue.href}
              className={cn(
                "flex h-full flex-col gap-1 rounded-xl border p-4 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                queue.count > 0 ? "bg-card" : "border-dashed",
              )}
            >
              <span
                className={cn(
                  "text-3xl tracking-tight tabular-nums",
                  queue.count > 0 ? "font-semibold" : "font-normal text-muted-foreground",
                )}
              >
                {queue.count}
              </span>
              <span
                className={cn(
                  "flex items-center gap-2 text-sm",
                  queue.count > 0 ? "font-medium" : "text-muted-foreground",
                )}
              >
                {/* The destination's icon in the sidebar, so the card and the menu read as one place. */}
                <queue.Icon
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {t(`home.${queue.key}`)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t(queue.count > 0 ? "home.review" : "home.none")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
