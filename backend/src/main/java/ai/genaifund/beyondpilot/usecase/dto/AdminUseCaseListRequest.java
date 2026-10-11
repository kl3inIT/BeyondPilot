package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** What narrows the operators' list of use cases. Every member is optional. */
public record AdminUseCaseListRequest(
		@Parameter(description = "Use cases whose title or organization name contains this, ignoring case.") @Size(
				max = 100) @Nullable String q,
		@Parameter(description = "Only use cases in this status, as a reader sees it now.",
				schema = @Schema(allowableValues = { "draft", "in_review", "needs_changes", "approved",
						"closed" })) @Pattern(regexp = UseCaseCodes.STATUS) @Nullable String status,
		@Parameter(description = "Only use cases of this organization.") @Nullable UUID organizationId,
		@Parameter(description = "Only use cases featured when true, only those not featured when false.") @Nullable Boolean featured,
		@Parameter(
				description = "The order: `title` by the title, `closes` by the close date, `updated` by the last "
						+ "change; `-` before a key turns it round, and one without a title or a close date comes "
						+ "last either way. Without it, the newest first.",
				schema = @Schema(type = "string", allowableValues = { "title", "-title", "closes", "-closes", "updated",
						"-updated" })) @Pattern(regexp = UseCaseCodes.ADMIN_SORT) @Nullable String sort,
		@Parameter(description = "The page, counted from 1.",
				schema = @Schema(type = "integer", format = "int32", defaultValue = "1", minimum = "1")) @Min(1) @Nullable Integer page) {
}
