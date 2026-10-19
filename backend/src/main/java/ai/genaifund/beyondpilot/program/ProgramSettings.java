package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * A program as its admin pages hold it, Settings and Questions, for a module that reports it to an operator: the MCP
 * server's {@code get_program}.
 * @param pageKind {@code standard}, {@code custom} or {@code external}, which links to {@code externalUrl}
 * @param publishIssues what it still lacks before it can be published: {@code summary}, {@code cover}, {@code dates}
 * @param questionsFixed its applications have opened, which fixes the questions
 */
public record ProgramSettings(ProgramOverview program, @Nullable String summary, @Nullable String about,
		String pageKind, @Nullable String externalUrl, @Nullable String lumaEventId, List<String> publishIssues,
		List<KeyDate> keyDates, List<Event> events, List<Question> questions, boolean questionsFixed,
		Instant createdAt) {

	public record KeyDate(String title, Instant startsAt, @Nullable Instant endsAt, boolean allDay,
			@Nullable String note) {
	}

	public record Event(String title, Instant startsAt, @Nullable Instant endsAt, boolean online,
			@Nullable String city, @Nullable String country, @Nullable String registrationUrl) {
	}

	/**
	 * A question the application form asks.
	 * @param kind {@code short_text}, {@code long_text}, {@code single_choice}, {@code multi_choice}, {@code file},
	 * {@code link} or {@code confirm}
	 * @param options the choices of a choice question; empty otherwise
	 */
	public record Question(String kind, String label, @Nullable String help, boolean required, List<String> options,
			@Nullable Integer maxLength) {
	}

}
