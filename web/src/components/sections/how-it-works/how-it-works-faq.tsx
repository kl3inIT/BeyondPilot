import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/components/ui/section";

/** The questions a visitor to this page asks next; their answers are the home page's. */
const questions = ["find", "list", "apply"] as const;

/** The title beside the questions from `md`; stacked on phones. All answers start closed. */
function HowItWorksFaq() {
  const t = useTranslations("Home.faq");

  return (
    <Section>
      <div className="flex flex-col gap-8 py-16 md:flex-row md:gap-10 lg:gap-20 lg:py-24">
        <div className="flex flex-col gap-4 md:w-72 md:shrink-0 lg:w-90">
          <p className="text-xs font-semibold tracking-widest text-primary uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="text-3xl font-semibold tracking-headline md:text-4xl">{t("title")}</h2>
        </div>
        <Accordion size="lg" className="min-w-0 flex-1">
          {questions.map((id) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger>{t(`${id}Q`)}</AccordionTrigger>
              <AccordionContent>{t(`${id}A`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

export { HowItWorksFaq };
