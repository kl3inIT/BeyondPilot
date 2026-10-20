import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/actions/button";
import { siteRoutes } from "@/lib/site";

/** What an unknown or missing page shows: the 404, what happened, and two ways on. */
function NotFoundNotice() {
  const t = useTranslations("NotFound");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <p className="text-sm font-medium text-primary">404</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Button href={siteRoutes.home}>{t("home")}</Button>
        <Button prominence="secondary" href={siteRoutes.search}>
          <SearchIcon aria-hidden="true" />
          {t("search")}
        </Button>
      </div>
    </div>
  );
}

export { NotFoundNotice };
