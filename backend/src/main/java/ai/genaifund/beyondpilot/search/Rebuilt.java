package ai.genaifund.beyondpilot.search;

/**
 * What a rebuild of one kind did: the items it saved, and the rows it took out because their item is no longer
 * public.
 */
record Rebuilt(int saved, int removed) {
}
