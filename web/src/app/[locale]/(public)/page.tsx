import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { Directory } from "@/components/sections/directory/directory";
import { ProgramsEvents } from "@/components/sections/events/programs-events";
import { Faq } from "@/components/sections/faq/faq";
import { Founders } from "@/components/sections/founders/founders";
import { Hero } from "@/components/sections/hero/hero";
import { PartnerNetwork } from "@/components/sections/logos/partner-network";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);

  return (
    <>
      <Hero />
      <ProgramsEvents />
      <Directory />
      <PartnerNetwork />
      <Founders />
      <Faq />
    </>
  );
}
