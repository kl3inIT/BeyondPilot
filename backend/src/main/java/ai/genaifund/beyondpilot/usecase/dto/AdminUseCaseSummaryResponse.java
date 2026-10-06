package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminUseCaseSummary", description = "One use case in the operators' list.")
public record AdminUseCaseSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UseCaseOrganizationResponse organization,
		@Schema(types = { "string", "null" }) @Nullable String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "published", "closed" },
				description = "Closed once the close date has passed, whatever the use case was before.") String status,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
