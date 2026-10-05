package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the public directory of talent. Every member is optional. */
public record PublicTalentListRequest(
		@Parameter(description = "Profiles whose name, headline or a skill contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only profiles with this role.") @Pattern(
				regexp = TalentCodes.ROLE) @Nullable String role,
		@Parameter(description = "Only profiles of this availability.") @Pattern(
				regexp = TalentCodes.AVAILABILITY) @Nullable String availability,
		@Parameter(description = "The order: by name, or the most recently approved first.",
				schema = @Schema(type = "string", allowableValues = { "name", "newest" },
						defaultValue = "name")) @Pattern(regexp = TalentCodes.SORT) @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
