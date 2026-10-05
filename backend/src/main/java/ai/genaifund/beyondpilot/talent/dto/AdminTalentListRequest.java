package ai.genaifund.beyondpilot.talent.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of talent profiles. Every member is optional. */
public record AdminTalentListRequest(
		@Parameter(description = "Profiles whose name contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only profiles of this status. Drafts are never listed.",
				schema = @Schema(allowableValues = { "submitted", "approved", "rejected" })) @Pattern(
						regexp = "submitted|approved|rejected") @Nullable String status,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
