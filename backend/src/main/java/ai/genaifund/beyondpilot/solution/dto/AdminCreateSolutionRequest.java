package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminCreateSolution",
		description = "What an operator needs to start a solution for an organization. It is created as a draft.")
public record AdminCreateSolutionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The approved organization the solution belongs to.") @NotNull UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 120) String name) {
}
