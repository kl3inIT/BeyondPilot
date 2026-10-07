import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AudiencePaths } from "@/components/sections/how-it-works/audience-paths";
import { ChallengeTimeline } from "@/components/sections/how-it-works/challenge-timeline";
import { HowItWorksCta } from "@/components/sections/how-it-works/how-it-works-cta";
import { HowItWorksFaq } from "@/components/sections/how-it-works/how-it-works-faq";
import { HowItWorksIntro } from "@/components/sections/how-it-works/how-it-works-intro";
import { HowItWorksSteps } from "@/components/sections/how-it-works/how-it-works-steps";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/how-it-works">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "HowItWorks" });

  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function HowItWorksRoute({ params }: PageProps<"/[locale]/how-it-works">) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <HowItWorksIntro />
      <HowItWorksSteps />
      <ChallengeTimeline />
      <AudiencePaths />
      <HowItWorksFaq />
      <HowItWorksCta />
    </>
  );
}
