import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

import { JsonLd } from "@/components/layout/json-ld";
import { Directory } from "@/components/sections/directory/directory";
import { ProgramsEvents } from "@/components/sections/events/programs-events";
import { Faq } from "@/components/sections/faq/faq";
import { Founders } from "@/components/sections/founders/founders";
import { Hero } from "@/components/sections/hero/hero";
import { PartnerNetwork } from "@/components/sections/logos/partner-network";
import { routing } from "@/i18n/routing";
import { genaiFundLinks, siteOrigin } from "@/lib/site";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const site = useTranslations("Site");
  const metadata = useTranslations("Metadata");

  return (
    <>
      {/* Who stands behind the site, for search engines and agents. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": `${siteOrigin}/#organization`,
              name: site("brand"),
              url: siteOrigin,
              description: metadata("description"),
              funder: {
                "@type": "Organization",
                name: site("genaiFund"),
                url: genaiFundLinks.site,
              },
            },
            {
              "@type": "WebSite",
              "@id": `${siteOrigin}/#website`,
              name: site("brand"),
              url: siteOrigin,
              inLanguage: routing.locales,
              publisher: { "@id": `${siteOrigin}/#organization` },
            },
          ],
        }}
      />
      <Hero />
      <ProgramsEvents />
      <Directory />
      <PartnerNetwork />
      <Founders />
      <Faq />
    </>
  );
}
