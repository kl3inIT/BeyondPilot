package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A program as the operators' list shows it, in any status, for a module that reports programs to an operator: the
 * MCP server's {@code list_programs}.
 * @param type such as {@code enterprise_challenge} or {@code hackathon}
 * @param status {@code draft} or {@code published}
 * @param phase {@code upcoming}, {@code open}, {@code running} or {@code done}, worked out from its dates now
 * @param applications when it takes applications here; null when it takes none
 * @param featuredAt when an operator featured it; null while it is not featured
 */
public record ProgramOverview(UUID id, String slug, String name, String type, @Nullable String partnerName,
		String status, String phase, @Nullable Window applications, @Nullable LocalDate startsOn,
		@Nullable LocalDate endsOn, @Nullable Instant featuredAt, Instant updatedAt) {

	/**
	 * When and how a program takes applications.
	 * @param shortlistSize how many applications go on to the next round
	 * @param outcomesDueOn the day applicants hear the outcome
	 * @param allowUpdatesUntilClose an applicant may change a submitted application until the deadline
	 */
	public record Window(Instant opensAt, Instant closesAt, @Nullable Integer shortlistSize,
			@Nullable LocalDate outcomesDueOn, boolean allowUpdatesUntilClose) {
	}

}
