import type { Consent, ConsentPurpose, ConsentRequest } from "@/lib/api/generated";

/** The purposes in the order the consent text lists them. */
const purposes = [
  "platform",
  "partners",
  "ai",
  "updates",
] as const satisfies readonly ConsentPurpose["key"][];

type Purpose = (typeof purposes)[number];

type Choices = Record<Purpose, boolean>;

/** Where a choice was made, recorded with it. */
type ChoiceSource = ConsentRequest["source"];

const everything: Choices = { platform: true, partners: true, ai: true, updates: true };

/** The person's current choices; a purpose they have not answered starts unticked. */
function choicesOf(consent: Consent): Choices {
  const granted = (key: Purpose) =>
    consent.purposes.find((purpose) => purpose.key === key)?.granted === true;
  return {
    platform: granted("platform"),
    partners: granted("partners"),
    ai: granted("ai"),
    updates: granted("updates"),
  };
}

export { choicesOf, everything, purposes, type ChoiceSource, type Choices, type Purpose };
