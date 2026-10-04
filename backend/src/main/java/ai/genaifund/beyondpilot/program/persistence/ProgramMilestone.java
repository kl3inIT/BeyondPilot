package ai.genaifund.beyondpilot.program.persistence;

import java.time.Instant;

import jakarta.persistence.Embeddable;

import org.jspecify.annotations.Nullable;

/**
 * A dated step of a program that an applicant plans around.
 * @param allDay the step is a day, not a moment, and is shown without a time
 */
@Embeddable
public record ProgramMilestone(String title, Instant startsAt, @Nullable Instant endsAt, boolean allDay,
		@Nullable String note) {
}
