package ai.genaifund.beyondpilot.matching.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

@Schema(name = "AddMatchingCandidate", description = "A solution an operator puts among the candidates by hand.")
public record AddCandidateRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "An approved solution that is not a candidate yet.") @NotNull UUID solutionId) {
}
