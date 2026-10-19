package ai.genaifund.beyondpilot.proposal;

/** How many applications a program has in each state, for a module that lists programs to an operator. */
public record ApplicationCounts(long submitted, long drafts, long withdrawn) {

	public static final ApplicationCounts NONE = new ApplicationCounts(0, 0, 0);

}
