package ai.genaifund.beyondpilot.talent.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TalentReviewQueue",
		description = "How many talent profiles wait for review now, since when, "
				+ "and how many waited at the end of each of the last 14 days.")
public record TalentReviewQueueResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many wait now.") long waiting,
		@Schema(description = "When the one that has waited longest was sent; null when none waits.")
		@Nullable Instant oldestSince,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The first of the days, in Asia/Ho_Chi_Minh.") LocalDate from,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many waited at the end of each day from `from` to today, oldest first; today's is `waiting`. "
						+ "A day behind today is an approximation: a record keeps only its last sending and its last "
						+ "decision.") List<Long> days) {
}
