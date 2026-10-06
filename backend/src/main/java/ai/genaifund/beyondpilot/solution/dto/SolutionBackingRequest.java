package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "BackSolution",
		description = "What GenAI Fund says of a solution, as an operator writes it. A member left out or empty is "
				+ "taken away.")
public record SolutionBackingRequest(
		@Schema(types = { "string", "null" },
				description = "Who backs its company, such as GenAI Fund's portfolio.") @Size(max = 120) @Nullable String backedBy,
		@Schema(types = { "string", "null" },
				description = "The programme it was selected for, with its cohort.") @Size(max = 120) @Nullable String program,
		@Schema(types = { "string", "null" },
				description = "How its company is funded.") @Size(max = 120) @Nullable String funding) {
}
