package ai.genaifund.beyondpilot.search.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * What a visitor searches for, and which part of the results they look at. Results past page 50 are not worth reading;
 * a person refines the query instead.
 */
public record SearchRequest(
		@Parameter(description = "What to search for, as the person typed it.", required = true) @NotBlank @Size(min = 1,
				max = 100) String q,
		@Parameter(description = "Only items of this kind; every kind when absent.",
				schema = @Schema(allowableValues = { "program", "solution", "talent" })) @Pattern(
						regexp = "program|solution|talent") @Nullable String kind,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1",
						maximum = "50")) @Min(1) @Max(50) @Nullable Integer page) {
}
