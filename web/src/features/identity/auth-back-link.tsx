import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

/** The one way out of the sign-in screen, at the far end of the header the auth layout draws. */
function AuthBackLink() {
  const t = useTranslations("SignIn");

  return (
    <Link
      href={siteRoutes.home}
      className="hit-area absolute top-5 right-5 inline-flex h-7 items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:right-8 lg:right-16"
    >
      <ArrowLeftIcon className="size-4" aria-hidden="true" />
      {t("back")}
    </Link>
  );
}

export { AuthBackLink };
