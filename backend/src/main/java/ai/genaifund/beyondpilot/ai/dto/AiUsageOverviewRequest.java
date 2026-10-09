package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Pattern;
import org.jspecify.annotations.Nullable;

/** Which period the Overview of Admin › AI › Usage covers, and what its table groups the calls by. */
public record AiUsageOverviewRequest(
		@Parameter(description = "Today, or the last 7 or 30 days with today, in Asia/Ho_Chi_Minh.",
				schema = @Schema(allowableValues = { "today", "7d", "30d" }, defaultValue = "today")) @Pattern(
						regexp = "today|7d|30d") @Nullable String period,
		@Parameter(description = "What the breakdown groups by. By model, a row is a model on a provider for a task.",
				schema = @Schema(allowableValues = { "model", "task", "provider" }, defaultValue = "model")) @Pattern(
						regexp = "model|task|provider") @Nullable String by) {
}
