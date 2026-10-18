package ai.genaifund.beyondpilot.solution.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(name = "AdminCreateOffer", description = "A new offer an operator writes for the organization that gives it.")
public record AdminCreateOfferRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The organization that gives it; only its solutions come with it.") @NotNull UUID organizationId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it on a card.") @NotBlank @Size(max = 80) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") @NotBlank @Size(max = 2048) @Pattern(
						regexp = SolutionCodes.OFFER_URL) String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether GenAI Fund arranged it with the organization, which its card marks.") boolean fromGenAiFund) {
}
