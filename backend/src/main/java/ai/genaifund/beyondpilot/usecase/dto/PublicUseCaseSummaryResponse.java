package ai.genaifund.beyondpilot.usecase.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "PublicUseCaseSummary", description = "A published use case as the public list shows it.")
public record PublicUseCaseSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" },
				description = "The organization's name; null when it asked to stay anonymous.") @Nullable String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String industry,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The outcomes the organization expects.") String goal,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> technologies,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "Whole units of currency; null while the budget is to be determined or is for members only.") @Nullable Long budgetMin,
		@Schema(types = { "integer", "null" }, format = "int64") @Nullable Long budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "USD", "VND" },
				description = "The currency of the amounts.") String currency,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the organization shows the budget to members only.") boolean budgetMembersOnly,
		@Schema(types = { "integer", "null" }, description = "Null when the brief does not say.") @Nullable Integer timelineMinWeeks,
		@Schema(types = { "integer", "null" }, description = "Null when the brief does not say.") @Nullable Integer timelineMaxWeeks,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "Proposals close at this instant; null for no deadline.") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant publishedAt) {
}
