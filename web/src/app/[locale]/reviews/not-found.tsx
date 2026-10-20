import { getTranslations } from "next-intl/server";

import { Button } from "@/components/actions/button";
import { getCurrentAccount } from "@/lib/auth/session";
import { siteRoutes } from "@/lib/site";

import NotFoundPage from "../not-found";

/**
 * What a page of Reviews shows when it answers not-found. A signed-in judge stays inside the frame,
 * with the sidebar and a way back to their programs. Without an account the layout draws no frame,
 * and the page reads as any unknown address does.
 */
export default async function ReviewsNotFoundPage() {
  const account = await getCurrentAccount();
  if (!account) {
    return <NotFoundPage />;
  }
  const [t, review] = await Promise.all([
    getTranslations("NotFound"),
    getTranslations("Review.notFound"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="text-muted-foreground">{review("description")}</p>
      <Button prominence="secondary" href={siteRoutes.reviews} className="self-start">
        {review("home")}
      </Button>
    </div>
  );
}
