package ai.genaifund.beyondpilot.ai.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the log of calls in Admin › AI › Usage. Every member is optional. */
public record AiUsageCallListRequest(
		@Parameter(description = "Today, or the last 7 or 30 days with today, in Asia/Ho_Chi_Minh.",
				schema = @Schema(allowableValues = { "today", "7d", "30d" }, defaultValue = "today")) @Pattern(
						regexp = "today|7d|30d") @Nullable String period,
		@Parameter(description = "Only calls made for this task, as the call named it.") @Size(max = 100) @Nullable String task,
		@Parameter(description = "Only calls to the provider with this name.") @Size(max = 200) @Nullable String provider,
		@Parameter(description = "Only calls to the model with this name.") @Size(max = 200) @Nullable String model,
		@Parameter(description = "Only calls that ended this way.",
				schema = @Schema(allowableValues = { "ok", "failed" })) @Pattern(regexp = "ok|failed") @Nullable String outcome,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
