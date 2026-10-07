package ai.genaifund.beyondpilot.organization.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of organizations. Every member is optional. */
public record AdminOrganizationListRequest(
		@Parameter(description = "Organizations whose name or domain contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only organizations of this review status; `in_review` also selects an approved one with an open claim, `approved` leaves out those taken down, and `suspended` selects those taken down. Merged organizations are listed only under `merged`.",
				schema = @Schema(allowableValues = { "in_review", "needs_changes", "approved", "rejected", "suspended",
						"merged" })) @Pattern(
								regexp = "in_review|needs_changes|approved|rejected|suspended|merged") @Nullable String status,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
