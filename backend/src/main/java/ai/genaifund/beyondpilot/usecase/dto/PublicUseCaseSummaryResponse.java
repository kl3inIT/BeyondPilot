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
		@Schema(types = { "integer", "null" },
				description = "In US dollars; null while the budget is to be determined or is for members only.") @Nullable Integer budgetMin,
		@Schema(types = { "integer", "null" }) @Nullable Integer budgetMax,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean budgetToBeDetermined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the organization shows the budget to members only.") boolean budgetMembersOnly,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int timelineMinWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int timelineMaxWeeks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Proposals close at this instant.") Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant publishedAt) {
}
