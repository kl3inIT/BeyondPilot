import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

import NotFoundPage from "../not-found";

/**
 * What a page of the admin area shows when it answers not-found. An operator who follows a link to
 * a record that is gone stays inside the frame, with the sidebar and a way back to the admin home.
 * Anyone else was turned away by `requireRole`: the layout draws them no frame, and here they get
 * the page any unknown address gets, so the refusal says nothing of the admin area.
 */
export default async function AdminNotFoundPage() {
  const account = await getCurrentAccount();
  if (account?.role !== "operator") {
    return <NotFoundPage />;
  }
  const [t, admin] = await Promise.all([
    getTranslations("NotFound"),
    getTranslations("Admin.notFound"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{admin("description")}</p>
      <Button prominence="secondary" href={siteRoutes.admin} className="self-start">
        {admin("home")}
      </Button>
    </div>
  );
}
