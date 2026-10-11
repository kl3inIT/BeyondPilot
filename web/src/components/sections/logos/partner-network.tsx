import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

/** Each shape's tallest height in pixels (md and up), so a logo asks for an image of its drawn width. */
const logoHeight = { wordmark: 22, long: 24, medium: 28, stacked: 36, emblem: 48 } as const;

/**
 * A logo's height follows its shape, so a long wordmark and a stacked mark carry the same weight
 * on the panel: the longer the mark, the lower it sits.
 */
const logo = cva("w-auto", {
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

type Organisation = { file: string; name: string; width: number; shape: keyof typeof logoHeight };

type Role = {
  role: "enterprises" | "technology" | "government";
  organisations: Organisation[];
};

/**
 * Organisations GenAI Fund works with, by the role they play; the enterprises open with the five
 * the ecosystem strip shows. Every file is 112px tall; its source is in
 * docs/research/data/landing-image-sources.json.
 */
const network: Role[] = [
  {
    role: "enterprises",
    organisations: [
      { file: "tasco", name: "Tasco", width: 779, shape: "wordmark" },
      { file: "shinhan", name: "Shinhan Future's Lab", width: 999, shape: "wordmark" },
      { file: "coca-cola", name: "Coca-Cola Beverages Vietnam", width: 201, shape: "emblem" },
      { file: "kfc", name: "KFC Vietnam", width: 234, shape: "stacked" },
      { file: "guardian", name: "Guardian", width: 423, shape: "medium" },
      { file: "vnggames", name: "VNGGames", width: 792, shape: "wordmark" },
      { file: "fpt", name: "FPT", width: 185, shape: "stacked" },
      { file: "gotyme", name: "GoTyme Bank", width: 332, shape: "stacked" },
      { file: "the-anam", name: "The Anam", width: 114, shape: "emblem" },
      { file: "sovico", name: "Sovico Group", width: 181, shape: "emblem" },
      { file: "hdbank", name: "HDBank", width: 417, shape: "medium" },
      { file: "vietjet", name: "Vietjet Air", width: 645, shape: "long" },
      { file: "mb", name: "MB", width: 268, shape: "stacked" },
      { file: "vndirect", name: "VNDIRECT", width: 552, shape: "long" },
      { file: "sabeco", name: "SABECO", width: 113, shape: "emblem" },
      { file: "phongvu", name: "Phong Vu", width: 780, shape: "wordmark" },
      { file: "prudential", name: "Prudential", width: 240, shape: "stacked" },
      { file: "uob", name: "UOB", width: 395, shape: "medium" },
      { file: "gic", name: "GIC", width: 226, shape: "stacked" },
      { file: "julius-baer", name: "Julius Baer", width: 567, shape: "long" },
      { file: "volkswagen", name: "Volkswagen Group Singapore", width: 494, shape: "medium" },
      { file: "globe", name: "Globe", width: 297, shape: "stacked" },
      { file: "sime-darby-property", name: "Sime Darby Property", width: 295, shape: "stacked" },
      { file: "resorts-world", name: "Resorts World", width: 330, shape: "stacked" },
      { file: "media-prima", name: "Media Prima", width: 225, shape: "stacked" },
      { file: "webtvasia", name: "WebTVAsia", width: 305, shape: "stacked" },
      { file: "mindvalley", name: "Mindvalley", width: 694, shape: "wordmark" },
      { file: "mydin", name: "MYDIN", width: 509, shape: "medium" },
      { file: "mamee", name: "Mamee", width: 436, shape: "medium" },
      { file: "emart24", name: "emart24", width: 563, shape: "long" },
      { file: "jk", name: "JK", width: 196, shape: "stacked" },
      { file: "royalton", name: "Royalton", width: 280, shape: "stacked" },
      { file: "paynet", name: "PayNet Fintech Hub", width: 376, shape: "medium" },
      { file: "paragon", name: "ParagonCorp", width: 808, shape: "wordmark" },
      {
        file: "asia-school-of-business",
        name: "Asia School of Business",
        width: 300,
        shape: "stacked",
      },
    ],
  },
  {
    role: "technology",
    organisations: [
      { file: "aws", name: "AWS", width: 187, shape: "stacked" },
      { file: "microsoft", name: "Microsoft for Startups", width: 273, shape: "stacked" },
      { file: "google-cloud", name: "Google Cloud", width: 713, shape: "wordmark" },
      { file: "nvidia", name: "NVIDIA", width: 607, shape: "long" },
      { file: "openai", name: "OpenAI", width: 417, shape: "medium" },
      { file: "alibaba-cloud", name: "Alibaba Cloud", width: 780, shape: "wordmark" },
      { file: "byteplus", name: "BytePlus", width: 629, shape: "long" },
      { file: "tencent-cloud", name: "Tencent Cloud", width: 1053, shape: "wordmark" },
      { file: "databricks", name: "Databricks", width: 200, shape: "emblem" },
      { file: "trae", name: "TRAE", width: 565, shape: "long" },
      { file: "bright-data", name: "Bright Data", width: 493, shape: "medium" },
      { file: "agora", name: "Agora", width: 325, shape: "stacked" },
      { file: "apify", name: "Apify", width: 407, shape: "medium" },
      { file: "qoder", name: "Qoder", width: 459, shape: "medium" },
      { file: "langfuse", name: "Langfuse", width: 586, shape: "long" },
      { file: "featherless", name: "Featherless", width: 506, shape: "medium" },
      { file: "tinyfish", name: "TinyFish", width: 442, shape: "medium" },
      { file: "kimi", name: "Kimi", width: 347, shape: "medium" },
      { file: "notion", name: "Notion", width: 307, shape: "stacked" },
    ],
  },
  {
    role: "government",
    organisations: [
      { file: "nic", name: "Vietnam National Innovation Center", width: 272, shape: "stacked" },
      { file: "disg", name: "Digital Industry Singapore", width: 331, shape: "stacked" },
      { file: "edb", name: "Singapore Economic Development Board", width: 225, shape: "stacked" },
      { file: "imda", name: "Infocomm Media Development Authority", width: 445, shape: "medium" },
      { file: "enterprise-singapore", name: "Enterprise Singapore", width: 360, shape: "stacked" },
      { file: "mdec", name: "MDEC", width: 591, shape: "long" },
      { file: "cradle", name: "Cradle", width: 448, shape: "medium" },
      { file: "sidec", name: "Sidec", width: 319, shape: "stacked" },
      { file: "digital-penang", name: "Digital Penang", width: 258, shape: "stacked" },
      { file: "startup-island-taiwan", name: "Startup Island Taiwan", width: 366, shape: "medium" },
    ],
  },
];

/**
 * "The network behind every program": one full-width panel per role, a wall of each organisation's
 * logo in its own colours, straight on the panel by day and on a light plate at night (DESIGN.md › Landing structure).
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
        <div className="flex flex-col gap-3 md:gap-4 xl:gap-5">
          {network.map(({ role, organisations }) => (
            <section
              key={role}
              aria-labelledby={`network-${role}`}
              className="flex flex-col gap-5 rounded-2xl border bg-card p-5 md:gap-7 md:p-7 xl:p-8"
            >
              <div className="flex flex-col gap-1">
                <h3 id={`network-${role}`} className="text-lg font-semibold">
                  {t(`roles.${role}.title`)}
                </h3>
                <p className="text-sm text-muted-foreground">{t(`roles.${role}.description`)}</p>
              </div>
              <ul className="flex flex-wrap items-center gap-x-6 gap-y-5 md:gap-x-10 md:gap-y-7 dark:rounded-xl dark:bg-logo-plate dark:p-5">
                {organisations.map(({ file, name, width, shape }) => (
                  <li key={file}>
                    <Image
                      src={`/partners/network/${file}.png`}
                      alt={name}
                      width={width}
                      height={112}
                      sizes={`${Math.ceil((width * logoHeight[shape]) / 112)}px`}
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
