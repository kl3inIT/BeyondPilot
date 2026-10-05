package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "RejectSolution", description = "Why a solution is not approved, and what its owners are told.")
public record RejectSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "incomplete", "not_an_ai_solution", "duplicate", "unverifiable",
						"other" }) @NotNull @Pattern(regexp = SolutionCodes.REJECTION) String reason,
		@Schema(types = { "string", "null" },
				description = "Shown to the owners with the rejection.") @Size(max = 1000) @Nullable String message) {
}
