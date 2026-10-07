package ai.genaifund.beyondpilot.usecase.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the public list of use cases. Every member is optional. */
public record PublicUseCaseListRequest(
		@Parameter(description = "Use cases whose title or goal contains this, or whose organization name does, "
				+ "ignoring case.") @Size(max = 100) @Nullable String q,
		@Parameter(description = "Only use cases of this industry.") @Pattern(
				regexp = UseCaseCodes.INDUSTRY) @Nullable String industry,
		@Parameter(description = "The order: the most recently published first, the nearest deadline first, or the "
				+ "largest budget first.",
				schema = @Schema(type = "string", allowableValues = { "newest", "deadline", "budget" },
						defaultValue = "newest")) @Pattern(regexp = UseCaseCodes.SORT) @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "Only use cases of the published program at this address.") @Size(
				max = 120) @Nullable String program) {
}
