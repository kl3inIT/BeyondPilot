package ai.genaifund.beyondpilot.program.persistence;

import java.util.Locale;

/** What kind of program it is, from the programs GenAI Fund has run. */
public enum ProgramType {

	ENTERPRISE_CHALLENGE,
	OPEN_INNOVATION_CALL,
	ACCELERATOR,
	HACKATHON,
	BUILDATHON,
	GRANT,
	VENTURE_BUILDING,
	PITCH_COMPETITION,
	EVENT_SERIES,
	EVENT;

	/** The value as the database and the API write it. */
	public String code() {
		return name().toLowerCase(Locale.ROOT);
	}

	public static ProgramType of(String code) {
		return valueOf(code.toUpperCase(Locale.ROOT));
	}
}
