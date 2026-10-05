package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the public directory of solutions. Every member is optional. */
public record PublicSolutionListRequest(
		@Parameter(description = "Solutions whose name or summary contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only solutions for this industry.") @Pattern(
				regexp = SolutionCodes.INDUSTRY) @Nullable String industry,
		@Parameter(description = "Only solutions of this focus area.") @Pattern(
				regexp = SolutionCodes.FOCUS_AREA) @Nullable String focusArea,
		@Parameter(description = "Only solutions of this maturity.") @Pattern(
				regexp = SolutionCodes.MATURITY) @Nullable String maturity,
		@Parameter(description = "Only solutions of the organization at this address.") @Size(
				max = 120) @Nullable String organization,
		@Parameter(description = "The order: by name, or the most recently approved first.",
				schema = @Schema(type = "string", allowableValues = { "name", "newest" },
						defaultValue = "name")) @Pattern(regexp = SolutionCodes.SORT) @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
