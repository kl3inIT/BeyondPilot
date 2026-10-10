import { createLoader, createSerializer, parseAsInteger, parseAsString } from "nuqs/server";

/** Which page of the disagreements Admin › AI › Matching shows, as the URL holds it: `?page=`. */
const matchingFeedbackSearch = { page: parseAsInteger.withDefault(1) };

export const loadMatchingFeedbackSearch = createLoader(matchingFeedbackSearch);

/** The address of the page with a page of the disagreements written into it. */
export const matchingFeedbackAddress = createSerializer(matchingFeedbackSearch);

/** The solution the Matched solutions page opens with, as the URL holds it: `?solution=`. */
export const loadMatchingSearch = createLoader({ solution: parseAsString });
