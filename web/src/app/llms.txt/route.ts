import { getTranslations } from "next-intl/server";

import { faqQuestions } from "@/components/sections/faq/faq-questions";
import { genaiFundLinks, liveCampaignDeadline, liveCampaignUrl, siteOrigin } from "@/lib/site";

// The campaign turns to closed at its deadline, so the file is answered at request time.
export const dynamic = "force-dynamic";

/**
 * An overview of the site for language models (llmstxt.org), in English and built from the same
 * messages the pages show, so it never says something the site does not. The live campaign is
 * described as closed once its deadline has passed.
 */
export async function GET() {
  const [meta, home, viHome, campaign, faq] = await Promise.all([
    getTranslations({ locale: "en", namespace: "Metadata" }),
    getTranslations({ locale: "en", namespace: "Home.hero" }),
    getTranslations({ locale: "vi", namespace: "Home.hero" }),
    getTranslations({ locale: "en", namespace: "Campaign" }),
    getTranslations({ locale: "en", namespace: "Home.faq" }),
  ]);
  const open = Date.now() < Date.parse(liveCampaignDeadline);

  const text = [
    `# ${meta("title")}`,
    "",
    `> ${meta("description")}`,
    "",
    faq("runsA"),
    "",
    "Every page is also served as Markdown to a request that sends `Accept: text/markdown`. The site is in English, and in Vietnamese under `/vi`.",
    "",
    "## Pages",
    "",
    `- [Home](${siteOrigin}/): ${home("description")}`,
    `- [Trang chủ](${siteOrigin}/vi): ${viHome("description")}`,
    "",
    "## Programs",
    "",
    `- [${campaign("name")}](${liveCampaignUrl}): ${campaign("partners")}. ${campaign("question")} ${open ? campaign("closes") : campaign("closed")}. ${campaign("facts.briefing")}: ${campaign("facts.briefingWhen")}. ${campaign("facts.demoDay")}: ${campaign("facts.demoDayWhen")}. ${campaign("facts.investment")}: ${campaign("facts.investmentValue")}.`,
    "",
    "## Questions and answers",
    "",
    ...faqQuestions.map((id) => `- **${faq(`${id}Q`)}** ${faq(`${id}A`)}`),
    "",
    "## Contact",
    "",
    `- [GenAI Fund](${genaiFundLinks.site}): ${genaiFundLinks.email}`,
    "",
  ].join("\n");

  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
