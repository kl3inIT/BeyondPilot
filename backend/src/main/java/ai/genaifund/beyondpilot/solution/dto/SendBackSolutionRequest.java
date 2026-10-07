package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "SendBackSolution", description = "Why GenAI Fund sends a solution back to its owners.")
public record SendBackSolutionRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
		description = "What the owners should change. They read it and receive it by email.") @NotBlank @Size(
				max = 1000) String reason) {
}
