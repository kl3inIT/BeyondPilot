/**
 * The answer to a question that takes several choices. Every answer to a program's question is one
 * text, so the backend keeps this one as a JSON array of the options chosen (proposal ›
 * ProposalService): `["Claims","Pricing"]`.
 */

/** The options an answer names, in the order it holds them; none when it is empty or not a list. */
export function chosenOptions(answer: string | null | undefined): string[] {
  if (!answer) {
    return [];
  }
  try {
    const chosen: unknown = JSON.parse(answer);
    return Array.isArray(chosen)
      ? chosen.filter((option): option is string => typeof option === "string")
      : [];
  } catch {
    return [];
  }
}

/** The answer that names these options; empty text when none is chosen, which is no answer. */
export function answerOfChosen(options: string[]): string {
  return options.length > 0 ? JSON.stringify(options) : "";
}
