package ai.genaifund.beyondpilot.organization.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "OrganizationReviewQueue",
		description = "How many ownership claims on organizations are open now, since when, and how many were open at "
				+ "the end of each of the last 14 days.")
public record OrganizationReviewQueueResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many ownership claims are open now.") long waiting,
		@Schema(description = "When the claim that has waited longest was made; null when none is open.")
		@Nullable Instant oldestSince,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The first of the days, in Asia/Ho_Chi_Minh.") LocalDate from,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many claims were open at the end of each day from `from` to today, oldest first; today's "
						+ "is `waiting`.") List<Long> days) {
}
