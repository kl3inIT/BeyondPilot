import { useTranslations } from "next-intl";
import Image from "next/image";

import { Link } from "@/i18n/navigation";
import { siteRoutes } from "@/lib/site";

type BrandLockupProps = {
  /** The header and menu show the logo alone; the footer adds "Funded by GenAI Fund" under it. */
  showBackedBy?: boolean;
};

/**
 * BeyondPilot's logo from the approved kit, as supplied: the purple tile with the charcoal wordmark
 * by day and the white wordmark at night. The file carries its own clear space (the tile is about
 * three quarters of its height), so the logo is drawn taller than the mark it shows. GenAI Fund
 * stands behind it in the footer.
 */
function BrandLockup({ showBackedBy = true }: BrandLockupProps) {
  const t = useTranslations("Site");

  return (
    <div className="flex flex-col items-start gap-3">
      <Link
        href={siteRoutes.home}
        className="hit-area -ml-0.5 flex rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Image
          src="/brand/beyondpilot-logo.svg"
          alt={t("brand")}
          width={2170}
          height={650}
          unoptimized
          className="h-10 w-auto dark:hidden"
        />
        <Image
          src="/brand/beyondpilot-logo-dark.svg"
          alt={t("brand")}
          width={2170}
          height={650}
          unoptimized
          className="hidden h-10 w-auto dark:block"
        />
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
