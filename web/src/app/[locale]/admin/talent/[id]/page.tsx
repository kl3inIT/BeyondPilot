import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AdminTalentPage } from "@/features/talent/admin-talent-page";
import { readAdminTalent, readAdminTalentList } from "@/features/talent/talent-queries";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes, titleSuffix } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/talent/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.talent" });

  // Several records open side by side are told apart by their tabs. Anyone but an operator gets no name.
  const record = await readAdminTalent(id).catch(() => null);

  return {
    title: record ? record.profile.name + titleSuffix : t("metaTitle"),
    robots: { index: false },
  };
}

export default async function AdminTalentRoute({
  params,
}: PageProps<"/[locale]/admin/talent/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireRole("operator", `${siteRoutes.adminTalent}/${id}`);
  const detail = await readAdminTalent(id);
  if (!detail) {
    notFound();
  }

  const waiting = await readAdminTalentList({ q: "", status: "submitted", page: 1 });
  // The queue is walked in its order: the record after this one, or its first when this is the last.
  const at = waiting.items.findIndex((item) => item.id === id);
  const other = waiting.items[at + 1] ?? waiting.items.find((item) => item.id !== id);
  const next = other ? { href: `${siteRoutes.adminTalent}/${other.id}`, name: other.name } : null;

  const queue = { place: at >= 0 ? at + 1 : null, total: waiting.total };

  return <AdminTalentPage detail={detail} next={next} queue={queue} />;
}
