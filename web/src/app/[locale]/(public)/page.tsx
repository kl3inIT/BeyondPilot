import { getTranslations, setRequestLocale } from "next-intl/server";

import { JsonLd } from "@/components/layout/json-ld";
import { AgentJourney } from "@/components/sections/agent-journey/agent-journey";
import { Categories } from "@/components/sections/categories/categories";
import { Ecosystem } from "@/components/sections/ecosystem/ecosystem";
import { Faq } from "@/components/sections/faq/faq";
import { FeaturedProgram } from "@/components/sections/featured-program/featured-program";
import { FinalCta } from "@/components/sections/final-cta/final-cta";
import { Hero } from "@/components/sections/hero/hero";
import { PartnerNetwork } from "@/components/sections/logos/partner-network";
import { GenaiFundBacking } from "@/components/sections/team/genai-fund-backing";
import { Section } from "@/components/ui/section";
import { readFeaturedProgram, readUpcomingEvents } from "@/features/program/program-public-queries";
import { routing } from "@/i18n/routing";
import { genaiFundLinks, ownOrigin } from "@/lib/site";

/**
 * The page is built ahead of time, when the backend cannot be reached, and rendered again at most a
 * minute after a visit, so the featured program an operator chooses, and the events of the
 * programs, reach it within a minute.
 */
export const revalidate = 60;

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [site, metadata, featured, events] = await Promise.all([
    getTranslations("Site"),
    getTranslations("Metadata"),
    readFeaturedProgram(),
    readUpcomingEvents(2),
  ]);
  const siteOrigin = ownOrigin();

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
              logo: `${siteOrigin}/brand/beyondpilot-logo.svg`,
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
      <Categories events={events} />
      <AgentJourney />
      <Section>
        <GenaiFundBacking />
      </Section>
      <PartnerNetwork />
      <Faq />
      <FinalCta />
      {featured && <FeaturedProgram program={featured} />}
    </>
  );
}
