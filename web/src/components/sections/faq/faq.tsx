import { useTranslations } from "next-intl";

import { JsonLd } from "@/components/layout/json-ld";
import { faqQuestions } from "@/components/sections/faq/faq-questions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/components/ui/section";

/** The title beside the answers from `lg`; stacked on narrower screens. */
function Faq() {
  const t = useTranslations("Home.faq");

  return (
    <Section>
      <div className="flex flex-col gap-8 pt-14 pb-16 lg:flex-row lg:gap-0 lg:pt-17 lg:pb-30">
        <div className="flex flex-col lg:w-120 lg:shrink-0">
          <p className="text-copy font-semibold text-primary">{t("eyebrow")}</p>
          <h2 className="mt-3 max-w-105 text-4xl font-semibold tracking-headline lg:text-section lg:tracking-section">
            {t("title")}
          </h2>
        </div>
        <Accordion size="lg" defaultValue={["what"]} className="min-w-0 flex-1 lg:mt-5.5">
          {faqQuestions.map((id) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger>{t(`${id}Q`)}</AccordionTrigger>
              <AccordionContent>{t(`${id}A`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      {/* Every answer, including the closed ones the accordion leaves out of the page. */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqQuestions.map((id) => ({
            "@type": "Question",
            name: t(`${id}Q`),
            acceptedAnswer: { "@type": "Answer", text: t(`${id}A`) },
          })),
        }}
      />
    </Section>
  );
}

export { Faq };
