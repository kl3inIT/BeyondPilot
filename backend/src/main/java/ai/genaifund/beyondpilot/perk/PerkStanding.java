package ai.genaifund.beyondpilot.perk;

/** Whether a person may get a perk at this moment, or the first reason they may not. */
enum PerkStanding {

	ELIGIBLE("eligible"),

	/** Nobody is signed in, and the perk is not a link for everyone. */
	SIGN_IN("sign_in"),

	/** The person acts for no active organization, and a perk is got for one. */
	ORGANIZATION("organization"),

	NOT_APPLIED("not_applied"),

	/** The team is not shortlisted, or the program has not released its outcomes. */
	NOT_SHORTLISTED("not_shortlisted"),

	NOT_STARTED("not_started"),

	ENDED("ended"),

	FULL("full"),

	/** The team, or the person for a perk got once per person, already holds a claim of it. */
	CLAIMED("claimed"),

	/** The perk is off the site; only those who got it still read it. */
	ARCHIVED("archived");

	private final String value;

	PerkStanding(String value) {
		this.value = value;
	}

	String value() {
		return value;
	}
}
