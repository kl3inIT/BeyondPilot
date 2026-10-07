package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "TakeDownSolution",
		description = "Why an approved solution is taken down, and what its owners are told.")
public record TakeDownSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "misleading_information", "not_an_ai_solution", "unverifiable", "breaks_the_rules",
						"other" }) @NotNull @Pattern(regexp = SolutionCodes.TAKEDOWN) String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the owners in their workspace.") @Size(max = 1000) @Nullable String message) {
}
