import { useTranslations } from "next-intl";
import Image from "next/image";

import { Section } from "@/components/ui/section";

type PartnerLogo = { src: string; name: string };

/** Partner and community logos from genaifund.ai, shown greyscale so no brand colour dominates. */
const partners: PartnerLogo[] = [
  { src: "/partners/partner-1.png", name: "Digital Industry" },
  { src: "/partners/partner-2.png", name: "NIC" },
  { src: "/partners/partner-3.png", name: "NVIDIA Inception" },
  { src: "/partners/partner-4.png", name: "AWS" },
  { src: "/partners/partner-5.png", name: "Google Cloud" },
  { src: "/partners/partner-6.png", name: "Databricks" },
  { src: "/partners/jdi.png", name: "JDI" },
  { src: "/partners/nvidia.png", name: "NVIDIA" },
  { src: "/partners/granite-asia.png", name: "Granite Asia" },
  { src: "/partners/founder-institute.png", name: "Founder Institute" },
];

function PartnerLogos() {
  const t = useTranslations("Home.logos");

  return (
    <Section spacing="compact">
      <div className="flex flex-col items-center gap-6 sm:gap-12">
        <h2 className="text-center text-sm font-semibold">{t("title")}</h2>
        <ul className="grid w-full grid-cols-3 items-center gap-x-6 gap-y-4 sm:grid-cols-5 lg:flex lg:flex-wrap lg:justify-center lg:gap-x-12">
          {partners.map((partner) => (
            <li key={partner.src} className="flex justify-center">
              <Image
                src={partner.src}
                alt={partner.name}
                width={240}
                height={112}
                className="h-10 w-24 object-contain opacity-70 grayscale sm:h-14 sm:w-30 dark:invert"
              />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

export { PartnerLogos };
