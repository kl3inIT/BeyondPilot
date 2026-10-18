package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "AdminSaveOffer", description = "An offer as an operator's form holds it.")
public record AdminSaveOfferRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it on a card.") @NotBlank @Size(max = 80) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") @NotBlank @Size(max = 2048) @Pattern(
						regexp = SolutionCodes.OFFER_URL) String url,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether GenAI Fund arranged it with the organization, which its card marks.") boolean fromGenAiFund,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; a save is refused when the offer changed since.") @Nullable Long version) {
}
