package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "CreateSolution", description = "What a solution cannot do without. It is created as a draft.")
public record CreateSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name) {
}
