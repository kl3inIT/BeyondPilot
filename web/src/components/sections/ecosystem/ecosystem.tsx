import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

const organisations = [
  { file: "aws", name: "AWS", width: 112 },
  { file: "nvidia", name: "NVIDIA", width: 112 },
  { file: "microsoft", name: "Microsoft", width: 126 },
  { file: "google-cloud", name: "Google Cloud", width: 126 },
  { file: "openai", name: "OpenAI", width: 104 },
] as const;

/** Organisations that took part in GenAI Fund programs, shown as the ecosystem and never as customers. */
function Ecosystem() {
  const t = useTranslations("Home.ecosystem");

  return (
    <Section surface="transparent">
      <div className="flex flex-col gap-6 py-16 lg:flex-row lg:items-center lg:gap-0 lg:pt-21 lg:pb-25">
        <h2 className="text-sm font-normal text-muted-foreground lg:w-110 lg:shrink-0">
          {t("title")}
        </h2>
        <ul aria-label={t("listLabel")} className="flex flex-wrap items-center gap-x-11 gap-y-5">
          {organisations.map(({ file, name, width }) => (
            <li key={file}>
              <Image
                src={`/partners/network/${file}.png`}
                alt={name}
                width={width}
                height={64}
                sizes={`${width}px`}
                className="h-8 w-auto dark:brightness-0 dark:invert"
              />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { Ecosystem };
