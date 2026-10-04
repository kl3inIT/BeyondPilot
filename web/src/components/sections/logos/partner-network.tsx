import { cva, type VariantProps } from "class-variance-authority";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

/**
 * A logo's height follows its shape, so a long wordmark and a stacked mark carry the same weight
 * on the panel: the longer the mark, the lower it sits. At night the logos turn to one light ink,
 * because several marks are dark on transparent.
 */
const logo = cva("w-auto dark:brightness-0 dark:invert", {
  variants: {
    shape: {
      wordmark: "h-4.5 md:h-5.5",
      long: "h-5 md:h-6",
      medium: "h-6 md:h-7",
      stacked: "h-7 md:h-9",
      emblem: "h-10 md:h-12",
    },
  },
});

// Twelve columns from `md`: the two large roles share the first row from `xl`, the three small ones the second, each as wide as its logos need.
const panel = cva("flex flex-col gap-5 rounded-2xl border bg-card p-5 md:gap-7 md:p-7 xl:p-8", {
  variants: {
    span: {
      wide: "md:col-span-12 xl:col-span-5",
      wider: "md:col-span-12 xl:col-span-7",
      narrow: "md:col-span-4 xl:col-span-3",
      third: "md:col-span-4",
      half: "md:col-span-4 xl:col-span-5",
    },
  },
});

type Organisation = { file: string; name: string; width: number } & Required<
  VariantProps<typeof logo>
>;

// The press only reports, so its panel carries no line about what it brings.
type Role = (
  | { role: "enterprises" | "technology" | "government" | "investors"; described: true }
  | { role: "press"; described: false }
) & { organisations: Organisation[] } & Required<VariantProps<typeof panel>>;

/**
 * Organisations that took part in GenAI Fund programs in 2025 and 2026, by the role they play.
 * Every file is 112px tall; its source is in docs/research/data/landing-image-sources.json.
 */
const network: Role[] = [
  {
    role: "enterprises",
    described: true,
    span: "wide",
    organisations: [
      { file: "tasco", name: "Tasco", width: 779, shape: "wordmark" },
      { file: "vnggames", name: "VNGGames", width: 792, shape: "wordmark" },
      { file: "fpt", name: "FPT", width: 185, shape: "stacked" },
      { file: "kfc", name: "KFC Vietnam", width: 234, shape: "stacked" },
      { file: "gotyme", name: "GoTyme Bank", width: 332, shape: "stacked" },
      { file: "the-anam", name: "The Anam", width: 114, shape: "emblem" },
    ],
  },
  {
    role: "technology",
    described: true,
    span: "wider",
    organisations: [
      { file: "aws", name: "AWS", width: 187, shape: "stacked" },
      { file: "nvidia", name: "NVIDIA", width: 607, shape: "long" },
      { file: "google-cloud", name: "Google Cloud", width: 713, shape: "wordmark" },
      { file: "microsoft", name: "Microsoft for Startups", width: 273, shape: "stacked" },
      { file: "openai", name: "OpenAI", width: 417, shape: "medium" },
      { file: "alibaba-cloud", name: "Alibaba Cloud", width: 780, shape: "wordmark" },
      { file: "databricks", name: "Databricks", width: 200, shape: "emblem" },
      { file: "langfuse", name: "Langfuse", width: 586, shape: "long" },
      { file: "notion", name: "Notion", width: 307, shape: "stacked" },
    ],
  },
  {
    role: "government",
    described: true,
    span: "narrow",
    organisations: [
      { file: "nic", name: "Vietnam National Innovation Center", width: 272, shape: "stacked" },
      { file: "disg", name: "Digital Industry Singapore", width: 331, shape: "stacked" },
    ],
  },
  {
    role: "investors",
    described: true,
    span: "third",
    organisations: [
      { file: "granite-asia", name: "Granite Asia", width: 708, shape: "wordmark" },
      { file: "founder-institute", name: "Founder Institute", width: 316, shape: "medium" },
      { file: "jdi", name: "JDI", width: 233, shape: "stacked" },
    ],
  },
  {
    role: "press",
    described: false,
    span: "half",
    organisations: [
      { file: "techinasia", name: "TechInAsia", width: 588, shape: "long" },
      { file: "e27", name: "e27", width: 302, shape: "medium" },
      { file: "vneconomy", name: "VnEconomy", width: 620, shape: "long" },
    ],
  },
];

/**
 * "The network behind every program": one panel per role, each organisation's logo in its own
 * colours straight on the panel (DESIGN.md › Landing structure).
 */
function PartnerNetwork() {
  const t = useTranslations("Home.network");

  return (
    <Section surface="muted">
      <div className="flex flex-col gap-7 py-14 md:gap-12 md:py-24">
        <div className="flex flex-col gap-3">
          <h2 className="text-3xl font-semibold tracking-headline md:text-headline">
            {t("title")}
          </h2>
          <p className="max-w-2xl text-lg text-muted-foreground">{t("description")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-12 md:gap-4 xl:gap-5">
          {network.map(({ role, described, span, organisations }) => (
            <section key={role} aria-labelledby={`network-${role}`} className={panel({ span })}>
              <div className="flex flex-col gap-1">
                <h3 id={`network-${role}`} className="text-lg font-semibold">
                  {t(`roles.${role}.title`)}
                </h3>
                {described && (
                  <p className="text-sm text-muted-foreground">{t(`roles.${role}.description`)}</p>
                )}
              </div>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-4 md:gap-x-8 md:gap-y-6">
                {organisations.map(({ file, name, width, shape }) => (
                  <li key={file}>
                    <Image
                      src={`/partners/network/${file}.png`}
                      alt={name}
                      width={width}
                      height={112}
                      className={logo({ shape })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </Section>
  );
}

export { PartnerNetwork };
