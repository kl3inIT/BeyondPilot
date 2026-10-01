import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "@/components/ui/section";

const questions = ["who", "company", "product", "review", "shortlist", "runs"] as const;

function Faq() {
  const t = useTranslations("Home.faq");

  return (
    <Section>
      <div className="mx-auto flex max-w-180 flex-col items-center gap-12">
        <h2 className="text-center text-3xl font-semibold sm:text-5xl sm:leading-none">
          {t("title")}
        </h2>
        <Accordion size="lg" defaultValue={["who"]} className="w-full">
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

export { Faq };
