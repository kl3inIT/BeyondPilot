package ai.genaifund.beyondpilot.program.persistence;

import java.util.Locale;

/** How the public page of a program is made. */
public enum PageKind {

	/** Built from the program's own fields. */
	STANDARD,

	/** Written in the web application for this program's address. */
	CUSTOM,

	/** Somewhere else: the list links to the program's external address. */
	EXTERNAL;

	/** The value as the database and the API write it. */
	public String code() {
		return name().toLowerCase(Locale.ROOT);
	}
}
