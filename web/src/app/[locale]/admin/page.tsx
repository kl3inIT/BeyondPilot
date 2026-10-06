import { BoxesIcon, BuildingIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { readAdminOrganizations } from "@/features/organization/organization-queries";
import { readAdminSolutions } from "@/features/solution/solution-queries";
import { readAdminTalentList } from "@/features/talent/talent-queries";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });

  return { title: t("metaTitle"), robots: { index: false } };
}

/** Admin home: what waits for a decision, each count a way to its list, already narrowed. */
export default async function AdminHomeRoute({ params }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.admin);
  const t = await getTranslations("Admin");
  const [organizations, solutions, talent] = await Promise.all([
    readAdminOrganizations({ q: "", status: "in_review", page: 1 }),
    readAdminSolutions({ q: "", status: "submitted", industry: null, page: 1 }),
    readAdminTalentList({ q: "", status: "in_review", page: 1 }),
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
      href: `${siteRoutes.adminSolutions}?status=submitted`,
      count: solutions.total,
    },
    {
      key: "talent" as const,
      Icon: UsersIcon,
      href: `${siteRoutes.adminTalent}?status=in_review`,
      count: talent.total,
    },
  ];
  const waiting = queues.reduce((sum, queue) => sum + queue.count, 0);

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-2 pb-12 md:px-6 lg:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("home.lead", { count: waiting })}</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-3">
        {queues.map((queue) => (
          <li key={queue.key}>
            <Link
              href={queue.href}
              className="flex h-full flex-col gap-1 rounded-xl border bg-card p-4 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="text-3xl font-semibold tracking-tight tabular-nums">
                {queue.count}
              </span>
              <span className="flex items-center gap-2 text-sm font-medium">
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
