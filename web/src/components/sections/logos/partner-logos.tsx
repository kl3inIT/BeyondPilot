import { cva } from "class-variance-authority";
import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

/** Partner and community logos from genaifund.ai, already greyscale; the Figma boxes size each. */
const partners = [
  { src: "/partners/partner-1.png", name: "Digital Industry Singapore", size: "large" },
  { src: "/partners/partner-2.png", name: "NIC", size: "medium" },
  { src: "/partners/partner-3.png", name: "NVIDIA Inception", size: "large" },
  { src: "/partners/partner-4.png", name: "AWS", size: "small" },
  { src: "/partners/partner-5.png", name: "Google Cloud", size: "medium" },
  { src: "/partners/partner-6.png", name: "Databricks", size: "medium" },
  { src: "/partners/jdi.png", name: "JDI", size: "small" },
  { src: "/partners/granite-asia.png", name: "Granite Asia", size: "medium" },
  { src: "/partners/founder-institute.png", name: "Founder Institute", size: "medium" },
] as const;

// White logo backgrounds melt into the floor: multiplied by day, inverted and screened by night.
const logo = cva("object-contain mix-blend-multiply dark:mix-blend-screen dark:invert", {
  variants: {
    layout: { grid: "h-9", marquee: "" },
    size: { large: "", medium: "", small: "" },
  },
  compoundVariants: [
    { layout: "grid", size: ["large", "medium"], class: "w-22.5" },
    { layout: "grid", size: "small", class: "w-18" },
    { layout: "marquee", size: "large", class: "h-16 w-40" },
    { layout: "marquee", size: "medium", class: "h-12 w-30" },
    { layout: "marquee", size: "small", class: "h-12 w-24" },
  ],
});

/**
 * "Backed by the GenAI Fund partner network": a single marquee from `md` (DESIGN.md › Landing
 * structure) and a static grid on phones, so nothing is cut at the screen edge.
 */
function PartnerLogos() {
  const t = useTranslations("Home.logos");

  return (
    <Section surface="muted">
      <div className="flex flex-col items-center gap-5 pt-8 pb-10 md:gap-7 md:pt-10 md:pb-16">
        <h2 className="text-center text-sm font-medium text-muted-foreground">{t("title")}</h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-5 opacity-75 md:hidden">
          {partners.map((partner) => (
            <li key={partner.src}>
              <Image
                src={partner.src}
                alt={partner.name}
                width={240}
                height={112}
                className={logo({ layout: "grid", size: partner.size })}
              />
            </li>
          ))}
        </ul>
        <div className="relative -mx-8 hidden h-12 self-stretch overflow-hidden md:block xl:-mx-16">
          <div className="flex w-max animate-marquee items-center opacity-75 hover:paused motion-reduce:animate-none">
            {[false, true].map((copy) => (
              <ul
                key={String(copy)}
                aria-hidden={copy || undefined}
                className="flex shrink-0 items-center gap-18 pr-18"
              >
                {partners.map((partner) => (
                  <li key={partner.src} className="flex h-12 items-center">
                    <Image
                      src={partner.src}
                      alt={copy ? "" : partner.name}
                      width={240}
                      height={112}
                      className={logo({ layout: "marquee", size: partner.size })}
                    />
                  </li>
                ))}
              </ul>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-50 bg-linear-to-r from-muted to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-50 bg-linear-to-l from-muted to-transparent"
          />
        </div>
      </div>
    </Section>
  );
}

export { PartnerLogos };
