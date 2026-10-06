package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "SolutionBacking",
		description = "What GenAI Fund says of a solution beside its owners' words. Operators write it; at least one "
				+ "member is set.")
public record SolutionBackingResponse(
		@Schema(types = { "string", "null" },
				description = "Who backs its company, such as GenAI Fund's portfolio.") @Nullable String backedBy,
		@Schema(types = { "string", "null" },
				description = "The programme it was selected for, with its cohort.") @Nullable String program,
		@Schema(types = { "string", "null" }, description = "How its company is funded.") @Nullable String funding,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time",
				description = "When an operator last wrote it.") Instant updatedAt) {
}
