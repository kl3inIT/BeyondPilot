import { useTranslations } from "next-intl";
import Image from "next/image";

import { BrandMark } from "@/components/layout/brand-mark";
import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type BrandLockupProps = {
  /** The header and menu show the name alone; the footer adds "Backed by GenAI Fund" under it. */
  showBackedBy?: boolean;
};

/** BeyondPilot's mark and name, with GenAI Fund standing behind it in the footer. */
function BrandLockup({ showBackedBy = true }: BrandLockupProps) {
  const t = useTranslations("Site");

  return (
    <div className="flex flex-col items-start gap-3">
      <Link
        href={siteRoutes.home}
        className="hit-area flex items-center gap-2 rounded-sm text-lg font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <BrandMark size={24} className="size-6 shrink-0" />
        {t("brand")}
      </Link>
      {showBackedBy && (
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {t("backedBy")}
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
