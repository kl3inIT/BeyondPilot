package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReviewHead", description = "The program under review and what the caller may do in it.")
public record ReviewHeadResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID programId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String slug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant closesAt,
		@Schema(types = { "string", "null" }, format = "date") @Nullable LocalDate outcomesDueOn,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether applications have closed.") boolean closed,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When the outcomes were released; null until then.") @Nullable Instant releasedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller is GenAI Fund staff, who read every score and decide.") boolean operator,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<CriterionResponse> criteria,
		@Schema(types = { "object", "null" },
				description = "The program's first one-choice question, whose answer the list shows and filters by.") @Nullable ChoiceQuestion choice) {

	@Schema(name = "ReviewChoiceQuestion")
	public record ChoiceQuestion(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> options) {
	}
}
