import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLd } from "@/components/layout/json-ld";
import { AgentJourney } from "@/components/sections/agent-journey/agent-journey";
import { Categories } from "@/components/sections/categories/categories";
import { FeaturedChallenge } from "@/components/sections/challenge/featured-challenge";
import { Ecosystem } from "@/components/sections/ecosystem/ecosystem";
import { Faq } from "@/components/sections/faq/faq";
import { FinalCta } from "@/components/sections/final-cta/final-cta";
import { Founders } from "@/components/sections/founders/founders";
import { Hero } from "@/components/sections/hero/hero";
import { Team } from "@/components/sections/team/team";
import { routing } from "@/i18n/routing";
import { genaiFundLinks, siteOrigin } from "@/lib/site";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [site, metadata] = await Promise.all([
    getTranslations("Site"),
    getTranslations("Metadata"),
  ]);

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
      <Ecosystem />
      <Categories />
      <AgentJourney />
      <FeaturedChallenge />
      <Team />
      <Founders />
      <Faq />
      <FinalCta />
    </>
  );
}
