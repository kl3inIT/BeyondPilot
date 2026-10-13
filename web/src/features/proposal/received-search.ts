import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { proposalTabs } from "./received-proposals";

/** The tab of a received list, as the URL holds it: `?tab=shortlisted`; All is the default and leaves no trace. */
const receivedSearch = {
  tab: parseAsStringLiteral(proposalTabs).withDefault("all"),
};

export const loadReceivedSearch = createLoader(receivedSearch);
