import { useTranslations } from "next-intl";
import Image from "next/image";

/** How GenAI Fund stands behind BeyondPilot, on the ink panel; shown on the home page and on About. */
function GenaiFundBacking() {
  const t = useTranslations("About.backing");
  const s = useTranslations("Site");

  return (
    <div className="mb-16 flex flex-col gap-6 rounded-3xl bg-foreground p-8 text-background lg:mb-20 lg:flex-row lg:gap-20 lg:px-10 lg:py-10">
      <div className="flex flex-col gap-3.5 lg:w-90 lg:shrink-0">
        <Image
          src="/brand/genaifund-logo-white.png"
          alt={s("genaiFund")}
          width={1200}
          height={254}
          className="h-10 w-auto self-start dark:hidden"
        />
        <Image
          src="/brand/genaifund-logo.png"
          alt={s("genaiFund")}
          width={1200}
          height={252}
          className="hidden h-10 w-auto self-start dark:block"
        />
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
      </div>
      <p className="max-w-185 text-copy text-background/80 lg:leading-6">{t("description")}</p>
    </div>
  );
}

export { GenaiFundBacking };
