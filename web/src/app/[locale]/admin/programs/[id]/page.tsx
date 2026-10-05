import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { adminProgramRoute } from "@/lib/site";

/** A program opens on its Settings, its one screen so far. */
export default async function ProgramAdminRoute({
  params,
}: PageProps<"/[locale]/admin/programs/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  redirect(getPathname({ href: adminProgramRoute(id), locale }));
}
