import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { PlatformBento } from "@/components/sections/bento/platform-bento";
import { Cta } from "@/components/sections/cta/cta";
import { EcosystemArc } from "@/components/sections/ecosystem/ecosystem-arc";
import { Faq } from "@/components/sections/faq/faq";
import { Founders } from "@/components/sections/founders/founders";
import { Hero } from "@/components/sections/hero/hero";
import { FeatureItems } from "@/components/sections/items/feature-items";
import { PartnerLogos } from "@/components/sections/logos/partner-logos";
import { HowItWorks } from "@/components/sections/steps/how-it-works";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <PartnerLogos />
      <PlatformBento />
      <FeatureItems />
      <EcosystemArc />
      <HowItWorks />
      <Founders />
      <Faq />
      <Cta />
    </>
  );
}
