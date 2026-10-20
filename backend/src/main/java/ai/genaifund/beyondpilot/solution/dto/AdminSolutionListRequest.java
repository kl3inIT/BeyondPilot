package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of solutions. Every member is optional. */
public record AdminSolutionListRequest(
		@Parameter(description = "Solutions whose name, or whose organization's name, contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only solutions offered by this organization.") @Nullable UUID organizationId,
		@Parameter(
				description = "Only solutions of this review status, or `suspended` for those taken down; `approved` "
						+ "leaves out those taken down. Drafts are never listed.",
				schema = @Schema(allowableValues = { "in_review", "needs_changes", "approved", "rejected",
						"suspended" })) @Pattern(
								regexp = "in_review|needs_changes|approved|rejected|suspended") @Nullable String status,
		@Parameter(description = "Only solutions for this industry.") @Pattern(
				regexp = SolutionCodes.INDUSTRY) @Nullable String industry,
		@Parameter(description = "Only solutions featured when true, only those not featured when false.") @Nullable Boolean featured,
		@Parameter(description = "`to_review`: only the solutions holding a customer deployment that waits for review.",
				schema = @Schema(allowableValues = { "to_review" })) @Pattern(
						regexp = "to_review") @Nullable String deployments,
		@Parameter(
				description = "The order: `name` by the name, `submitted` by when it was last sent for review; `-` "
						+ "before a key turns it round, and one never sent comes last either way. Without it, those "
						+ "with something waiting for review first, the longest wait on top.",
				schema = @Schema(type = "string", allowableValues = { "name", "-name", "submitted",
						"-submitted" })) @Pattern(regexp = "-?(name|submitted)") @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page,
		@Parameter(description = "How many items a page holds; the list's own page size when absent.",
				schema = @Schema(type = "integer", format = "int32", minimum = "1", maximum = "100")) @Min(1) @Max(
						100) @Nullable Integer size) {
}
