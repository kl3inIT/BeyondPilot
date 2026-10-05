package ai.genaifund.beyondpilot.program;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import ai.genaifund.beyondpilot.program.persistence.Program;

/**
 * What a program still lacks before it can be published. The Settings screen lists them and leads to each field; the
 * server checks them again when the program is published.
 */
enum PublishIssue {

	/** The list and the top of the page show it. */
	SUMMARY,

	/** The list and the top of the page show it. */
	COVER,

	/** Without them the program cannot tell whether it is upcoming, running or done. */
	DATES;

	/** The value as the API writes it. */
	String code() {
		return name().toLowerCase(Locale.ROOT);
	}

	static List<PublishIssue> of(Program program) {
		List<PublishIssue> issues = new ArrayList<>();
		if (program.getSummary() == null) {
			issues.add(SUMMARY);
		}
		if (program.getCoverFileId() == null) {
			issues.add(COVER);
		}
		if (program.getStartsOn() == null || program.getEndsOn() == null) {
			issues.add(DATES);
		}
		return issues;
	}
}
