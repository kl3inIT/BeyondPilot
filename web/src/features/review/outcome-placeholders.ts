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

/**
 * A link with its words, `[words](https://…)`, or a web address on its own, read as the backend
 * reads them: an address ends before a space, a bracket or the punctuation a sentence closes with.
 */
const OUTCOME_LINK =
  /\[([^[\]\n]+)\]\((https?:\/\/[^\s()<>]+)\)|(https?:\/\/[^\s()<>[\]]*[^\s()<>[\].,;:!?'"])/g;

type OutcomePart = { text: string; href?: string };

/**
 * A message as one applicant gets it, in text and links. The links are read before the names are
 * filled in, as the backend does, so a name never becomes a link.
 */
function outcomeParts(message: string, recipient: OutcomeRecipient): OutcomePart[] {
  const parts: OutcomePart[] = [];
  let end = 0;
  for (const match of message.matchAll(OUTCOME_LINK)) {
    parts.push({ text: fillOutcome(message.slice(end, match.index), recipient) });
    const href = match[2] ?? match[3] ?? "";
    parts.push({ text: match[1] ? fillOutcome(match[1], recipient) : href, href });
    end = match.index + match[0].length;
  }
  parts.push({ text: fillOutcome(message.slice(end), recipient) });
  return parts.filter((part) => part.text !== "");
}

/** A link as the message writes it; the address alone when it has no words of its own. */
function outcomeLink(words: string, address: string) {
  const trimmed = address.trim();
  const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const label = words.replace(/[[\]\n]+/g, " ").trim();
  return label === "" ? href : `[${label}](${href})`;
}

export { fillOutcome, outcomeLink, outcomeParts, unknownPlaceholders, type OutcomeRecipient };
