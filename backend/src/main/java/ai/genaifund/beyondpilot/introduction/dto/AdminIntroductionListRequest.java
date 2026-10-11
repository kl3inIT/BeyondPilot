package ai.genaifund.beyondpilot.introduction.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of requests for an introduction. Every member is optional. */
public record AdminIntroductionListRequest(
		@Parameter(description = "Requests about a solution whose name contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only requests in this state.",
				schema = @Schema(allowableValues = { "pending", "replied", "declined" })) @Pattern(
						regexp = "pending|replied|declined") @Nullable String status,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
