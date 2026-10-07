package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of solutions. Every member is optional. */
public record AdminSolutionListRequest(
		@Parameter(description = "Solutions whose name, or whose organization's name, contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(
				description = "Only solutions of this review status, or `suspended` for those taken down; `approved` "
						+ "leaves out those taken down. Drafts are never listed.",
				schema = @Schema(allowableValues = { "in_review", "needs_changes", "approved", "rejected",
						"suspended" })) @Pattern(
								regexp = "in_review|needs_changes|approved|rejected|suspended") @Nullable String status,
		@Parameter(description = "Only solutions for this industry.") @Pattern(
				regexp = SolutionCodes.INDUSTRY) @Nullable String industry,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
