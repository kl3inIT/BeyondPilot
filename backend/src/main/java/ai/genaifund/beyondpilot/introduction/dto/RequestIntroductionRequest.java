package ai.genaifund.beyondpilot.introduction.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(name = "RequestIntroduction", description = "A request for an introduction to the organization behind a solution.")
public record RequestIntroductionRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The address of the solution in the public directory.") @NotBlank @Size(max = 200) String solutionSlug,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the sender needs, as the provider reads it.") @NotBlank @Size(max = 2000) String message) {
}
