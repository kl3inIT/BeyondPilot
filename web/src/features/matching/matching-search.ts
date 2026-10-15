import { createLoader, createSerializer, parseAsInteger, parseAsString } from "nuqs/server";
import { pageSize } from "@/lib/page-size";

/** Which page of the disagreements Admin › AI › Matching shows, as the URL holds it: `?page=`. */
const matchingFeedbackSearch = { page: parseAsInteger.withDefault(1), size: pageSize };

export const loadMatchingFeedbackSearch = createLoader(matchingFeedbackSearch);

/** The address of the page with a page of the disagreements written into it. */
export const matchingFeedbackAddress = createSerializer(matchingFeedbackSearch);

const matchingRunsSearch = { page: parseAsInteger.withDefault(1), size: pageSize };

export const loadMatchingRunsSearch = createLoader(matchingRunsSearch);

/** The address of the Runs page with a page of the list written into it. */
export const matchingRunsAddress = createSerializer(matchingRunsSearch);

/** The solution the Matched solutions page opens with, as the URL holds it: `?solution=`. */
export const loadMatchingSearch = createLoader({ solution: parseAsString });
