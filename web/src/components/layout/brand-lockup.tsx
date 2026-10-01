import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type BrandLockupProps = {
  /** The "Powered by GenAI Fund" part can be dropped where width is tight. */
  showPoweredBy?: boolean;
};

/** "BeyondPilot | Powered by GenAI Fund": BeyondPilot leads, GenAI Fund stands behind it. */
function BrandLockup({ showPoweredBy = true }: BrandLockupProps) {
  const t = useTranslations("Site");

  return (
    <div className="flex items-center gap-3">
      <Link href={siteRoutes.home} className="text-lg font-bold tracking-tight">
        {t("brand")}
      </Link>
      {showPoweredBy && (
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="h-4.5 w-px bg-border" />
          <span className="flex items-center gap-3 text-sm text-muted-foreground">
            {t("poweredBy")}
            <Image
              src="/brand/genaifund-logo.png"
              alt={t("genaiFund")}
              width={1200}
              height={252}
              className="h-4 w-auto dark:hidden"
            />
            <Image
              src="/brand/genaifund-logo-white.png"
              alt={t("genaiFund")}
              width={1200}
              height={254}
              className="hidden h-4 w-auto dark:block"
            />
          </span>
        </div>
      )}
    </div>
  );
}

export { BrandLockup };
