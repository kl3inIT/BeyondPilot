package ai.genaifund.beyondpilot.program;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * What a published program asks of an application and when, as the module that takes applications needs it.
 * @param closesAt the instant after which no application is saved or submitted
 * @param allowUpdatesUntilClose whether a submitted application can still change until the close
 * @param questions the program's own questions, in the order the form asks them
 */
public record ApplicationForm(UUID programId, String slug, String name, Instant opensAt, Instant closesAt,
		@Nullable LocalDate outcomesDueOn, boolean allowUpdatesUntilClose, List<Question> questions) {

	/** Whether applications are taken at this instant: from the opening, up to the close. */
	public boolean openAt(Instant now) {
		return !now.isBefore(opensAt) && now.isBefore(closesAt);
	}

	/**
	 * One question of the form.
	 * @param kind {@code short_text}, {@code long_text}, {@code single_choice}, {@code file}, {@code link} or
	 * {@code confirm}
	 * @param maxLength the longest answer to a text question; null takes the form's default
	 */
	public record Question(UUID id, String kind, String label, @Nullable String help, boolean required,
			List<String> options, @Nullable Integer maxLength) {
	}
}
