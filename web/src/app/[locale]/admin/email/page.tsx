import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

/** Admin › Email opens on its templates. */
export default async function EmailRoute({ params }: PageProps<"/[locale]/admin/email">) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole("operator", siteRoutes.adminEmail);
  redirect(getPathname({ href: siteRoutes.adminEmailTemplates, locale }));
}
