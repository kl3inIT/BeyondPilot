package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "MyUseCaseSummary", description = "One use case of the caller's organization in the tab's list.")
public record MyUseCaseSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(types = { "string", "null" },
				description = "Null until someone has named the use case.") @Nullable String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "published", "closed" },
				description = "Closed once the close date has passed, whatever the use case was before.") String status,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant submittedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UseCasePersonResponse lastEditedBy,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt) {
}
