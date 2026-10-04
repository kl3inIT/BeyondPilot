import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AccountsPage } from "@/features/identity/accounts-page";
import { readAccounts } from "@/features/identity/accounts-queries";
import { loadAccountsSearch } from "@/features/identity/accounts-search";
import { ApiError } from "@/lib/api/client";
import { requireRole } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/admin/accounts">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin.accounts" });

  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccountsRoute({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/accounts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await requireRole("operator", siteRoutes.adminAccounts);
  const search = await loadAccountsSearch(searchParams);
  const accounts = await readAccounts(search).catch((error: unknown) => {
    // The role was withdrawn, or the session ended, between the check above and this read.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      notFound();
    }
    throw error;
  });

  return <AccountsPage accounts={accounts} search={search} me={me} />;
}
