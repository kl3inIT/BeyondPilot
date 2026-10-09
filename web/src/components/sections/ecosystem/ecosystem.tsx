import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

/** Every file is 112px tall; `height` is the height it is drawn at, by the shape of the mark. */
const organisations = [
  { file: "tasco", name: "Tasco", width: 779, height: "h-5" },
  { file: "vnggames", name: "VNGGames", width: 792, height: "h-5" },
  { file: "fpt", name: "FPT", width: 185, height: "h-9" },
  { file: "kfc", name: "KFC Vietnam", width: 234, height: "h-9" },
  { file: "gotyme", name: "GoTyme Bank", width: 332, height: "h-9" },
  { file: "the-anam", name: "The Anam", width: 114, height: "h-12" },
] as const;

/** Enterprises that took part in GenAI Fund programs, shown as the ecosystem and never as customers. */
function Ecosystem() {
  const t = useTranslations("Home.ecosystem");

  return (
    <Section surface="transparent">
      <div className="flex flex-col gap-6 py-16 lg:flex-row lg:items-center lg:gap-0 lg:pt-21 lg:pb-25">
        <h2 className="text-sm font-normal text-muted-foreground lg:w-90 lg:shrink-0">
          {t("title")}
        </h2>
        <ul
          aria-label={t("listLabel")}
          className="flex flex-wrap items-center gap-x-10 gap-y-6 lg:flex-1 lg:justify-between"
        >
          {organisations.map(({ file, name, width, height }) => (
            <li key={file}>
              <Image
                src={`/partners/network/${file}.png`}
                alt={name}
                width={width}
                height={112}
                sizes="160px"
                className={`${height} w-auto dark:brightness-0 dark:invert`}
              />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Ecosystem };
