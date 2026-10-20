import { createLoader, parseAsStringLiteral } from "nuqs/server";

import { proposalTabs, receivedViews } from "./received-proposals";

/**
 * The tab and the view of a received list, as the URL holds them: `?tab=shortlisted&view=compare`;
 * All and List are the defaults and leave no trace.
 */
const receivedSearch = {
  tab: parseAsStringLiteral(proposalTabs).withDefault("all"),
  view: parseAsStringLiteral(receivedViews).withDefault("list"),
};

export const loadReceivedSearch = createLoader(receivedSearch);
