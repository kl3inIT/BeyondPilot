package ai.genaifund.beyondpilot.matching.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.jspecify.annotations.Nullable;

/** Which page of the runs is read. */
public record MatchingRunListRequest(
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "How many runs a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
