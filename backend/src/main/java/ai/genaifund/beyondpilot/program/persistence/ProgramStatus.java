package ai.genaifund.beyondpilot.program.persistence;

import java.util.Locale;

/** Whether the public sees the program. */
public enum ProgramStatus {

	DRAFT, PUBLISHED;

	/** The value as the database and the API write it. */
	public String code() {
		return name().toLowerCase(Locale.ROOT);
	}
}
