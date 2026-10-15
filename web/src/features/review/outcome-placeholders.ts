/** The placeholders an outcome email may carry; the backend fills in exactly these, as written. */
const OUTCOME_PLACEHOLDERS = ["{organization}", "{solution}"] as const;

type OutcomeRecipient = { organization: string; solution: string };

/** A subject or a message as one applicant gets it, filled in the order the backend fills it. */
function fillOutcome(text: string, recipient: OutcomeRecipient) {
  return text
    .replaceAll("{organization}", recipient.organization)
    .replaceAll("{solution}", recipient.solution);
}

/**
 * What looks like a placeholder but is not one, such as `{organisation}` or `{Solution}`: the
 * backend leaves it as typed, so the applicant would read the braces.
 */
function unknownPlaceholders(...texts: string[]) {
  const found = texts.flatMap((text) => text.match(/\{[^{}\n]*\}/g) ?? []);
  const known: readonly string[] = OUTCOME_PLACEHOLDERS;
  return [...new Set(found.filter((token) => !known.includes(token)))];
}

export { fillOutcome, unknownPlaceholders, type OutcomeRecipient };
