import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { JsonLd } from "@/components/layout/json-ld";
import { Section } from "@/components/ui/section";
import { faqQuestions } from "@/components/sections/faq/faq-questions";
import { genaiFundLinks } from "@/lib/site";

/** The title and a way to ask beside the answers from `lg`; stacked on narrower screens. */
function Faq() {
  const t = useTranslations("Home.faq");

  return (
    <Section>
      <div className="flex flex-col gap-7 py-16 lg:flex-row lg:gap-20 lg:py-28">
        <div className="flex flex-col gap-4 lg:w-105 lg:shrink-0">
          <h2 className="text-3xl font-semibold tracking-headline md:text-headline">
            {t("title")}
          </h2>
          <p className="text-base text-muted-foreground">
            {t.rich("contact", {
              email: (chunks) => (
                <a
                  href={`mailto:${genaiFundLinks.email}`}
                  className="hit-area rounded-sm text-primary underline underline-offset-4 outline-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
        <Accordion size="lg" defaultValue={["who"]} className="min-w-0 flex-1">
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
