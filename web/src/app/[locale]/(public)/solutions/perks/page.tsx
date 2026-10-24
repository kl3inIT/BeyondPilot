import { permanentRedirect } from "next/navigation";

import { getPathname } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/** Perks are read on the solutions they go with: the former catalogue opens the directory filtered by them. */
export default async function PerksRoute({ params }: PageProps<"/[locale]/solutions/perks">) {
  const { locale } = await params;

  permanentRedirect(
    getPathname({ href: { pathname: siteRoutes.solutions, query: { perks: "active" } }, locale }),
  );
}
