package ai.genaifund.beyondpilot.program;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

/**
 * Where a program stands, at each boundary of its dates. The AI for Insurance Challenge runs from 23 September to 5
 * December 2026 and takes applications from 23 September, 00:00 to 15 October, 23:59 in Vietnam (UTC+7).
 */
class ProgramPhaseTest {

	private static final LocalDate STARTS = LocalDate.of(2026, 9, 23);

	private static final LocalDate ENDS = LocalDate.of(2026, 12, 5);

	private static final Instant OPENS = Instant.parse("2026-09-22T17:00:00Z");

	private static final Instant CLOSES = Instant.parse("2026-10-15T16:59:00Z");

	@Test
	void aProgramWithApplicationsMovesThroughEveryPhase() {
		assertThat(at("2026-09-22T16:59:59Z")).isEqualTo(ProgramPhase.UPCOMING);
		assertThat(at("2026-09-22T17:00:00Z")).isEqualTo(ProgramPhase.OPEN);
		assertThat(at("2026-10-15T16:58:59Z")).isEqualTo(ProgramPhase.OPEN);
		assertThat(at("2026-10-15T16:59:00Z")).isEqualTo(ProgramPhase.RUNNING);
		// 5 December is its last day in Vietnam until 17:00 UTC.
		assertThat(at("2026-12-05T16:59:59Z")).isEqualTo(ProgramPhase.RUNNING);
		assertThat(at("2026-12-05T17:00:00Z")).isEqualTo(ProgramPhase.DONE);
	}

	@Test
	void aProgramWithoutApplicationsIsUpcomingThenRunningThenDone() {
		assertThat(ProgramPhase.of(STARTS, ENDS, null, null, Instant.parse("2026-09-22T16:59:59Z")))
			.isEqualTo(ProgramPhase.UPCOMING);
		assertThat(ProgramPhase.of(STARTS, ENDS, null, null, Instant.parse("2026-09-22T17:00:00Z")))
			.isEqualTo(ProgramPhase.RUNNING);
		assertThat(ProgramPhase.of(STARTS, ENDS, null, null, Instant.parse("2026-12-05T17:00:00Z")))
			.isEqualTo(ProgramPhase.DONE);
	}

	@Test
	void applicationsThatOpenAfterTheStartKeepTheProgramUpcomingUntilThen() {
		Instant opens = Instant.parse("2026-10-01T02:00:00Z");
		assertThat(ProgramPhase.of(STARTS, ENDS, opens, CLOSES, Instant.parse("2026-09-30T10:00:00Z")))
			.isEqualTo(ProgramPhase.UPCOMING);
	}

	private static ProgramPhase at(String now) {
		return ProgramPhase.of(STARTS, ENDS, OPENS, CLOSES, Instant.parse(now));
	}

}
