package ai.genaifund.beyondpilot.proposal;

/**
 * Where an organization stands in a program, as another module may know it: nothing of GenAI Fund's decisions shows
 * before the program's outcomes are released.
 */
public enum ProgramStanding {

	/** No submitted application. */
	NONE,

	/** A submitted application, not withdrawn, whatever GenAI Fund decides of it. */
	APPLIED,

	/** A submitted application GenAI Fund shortlisted, in a program whose outcomes are released. */
	SHORTLISTED
}
