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
		@Parameter(description = "Only profiles of this review status; `approved` leaves out those taken down, and `suspended` selects those taken down. Drafts are never listed.",
				schema = @Schema(allowableValues = { "in_review", "needs_changes", "approved", "suspended" })) @Pattern(
						regexp = "in_review|needs_changes|approved|suspended") @Nullable String status,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
