import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type BrandLockupProps = {
  /** The header and menu show the name alone; the footer adds "Powered by GenAI Fund" under it. */
  showPoweredBy?: boolean;
};

/** "BeyondPilot", with GenAI Fund standing behind it in the footer. */
function BrandLockup({ showPoweredBy = true }: BrandLockupProps) {
  const t = useTranslations("Site");

  return (
    <div className="flex flex-col items-start gap-3">
      <Link
        href={siteRoutes.home}
        className="hit-area rounded-sm text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {t("brand")}
      </Link>
      {showPoweredBy && (
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {t("poweredBy")}
          <Image
            src="/brand/genaifund-logo.png"
            alt={t("genaiFund")}
            width={1200}
            height={252}
            className="h-5.25 w-auto dark:hidden"
          />
          <Image
            src="/brand/genaifund-logo-white.png"
            alt={t("genaiFund")}
            width={1200}
            height={254}
            className="hidden h-5.25 w-auto dark:block"
          />
        </p>
      )}
    </div>
  );
}

export { BrandLockup };
