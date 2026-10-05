package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Locale;

import org.jspecify.annotations.Nullable;

/**
 * Where a program stands at a moment, worked out from its dates. It is never stored, so the list is right the minute a
 * deadline passes without anyone acting.
 */
public enum ProgramPhase {

	/** It has not started, or its applications have not opened. */
	UPCOMING,

	/** It takes applications now. */
	OPEN,

	/** It goes on after its applications closed, or it takes none here, until its last day. */
	RUNNING,

	/** Its last day has passed. */
	DONE;

	/** Programs are run from Vietnam: a day an operator names is a day there. */
	public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

	/** The values as the API writes them, for the validation of a request. */
	public static final String CODES = "upcoming|open|running|done";

	/** The value as the API writes it. */
	public String code() {
		return name().toLowerCase(Locale.ROOT);
	}

	/**
	 * @param opensAt when applications open, or null for a program that takes none here
	 * @param closesAt when applications close, or null for a program that takes none here
	 */
	public static ProgramPhase of(@Nullable LocalDate startsOn, @Nullable LocalDate endsOn, @Nullable Instant opensAt,
			@Nullable Instant closesAt, Instant now) {
		LocalDate today = LocalDate.ofInstant(now, ZONE);
		if (endsOn != null && today.isAfter(endsOn)) {
			return DONE;
		}
		if (opensAt != null && closesAt != null && !now.isBefore(opensAt) && now.isBefore(closesAt)) {
			return OPEN;
		}
		if ((opensAt != null && now.isBefore(opensAt)) || (startsOn != null && today.isBefore(startsOn))) {
			return UPCOMING;
		}
		return RUNNING;
	}
}
