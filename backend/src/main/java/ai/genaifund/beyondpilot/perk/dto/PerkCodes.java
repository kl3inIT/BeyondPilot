package ai.genaifund.beyondpilot.perk.dto;

/** The codes the perk request records accept, as the patterns their members are checked against. */
final class PerkCodes {

	static final String AUDIENCE = "everyone|members|applicants|shortlisted";

	static final String WAY = "link|code|codes|request";

	/** A perk's addresses are opened from its page straight away, so they are https ones and nothing else. */
	static final String HTTPS = "https://[^\\s]+";

	static final int MAX_STEPS = 10;

	static final int MAX_QUESTIONS = 5;

	static final int MAX_SOLUTIONS = 20;

	static final int MAX_CODES = 5000;

	private PerkCodes() {
	}
}
