package ai.genaifund.beyondpilot.solution.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SaveOffer", description = "An offer as its form holds it.")
public record SaveOfferRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The line that names it on a card.") @NotBlank @Size(max = 80) String title,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The https address where it is claimed.") @NotBlank @Size(max = 2048) @Pattern(
						regexp = SolutionCodes.OFFER_URL) String url,
		@Schema(types = { "integer", "null" }, format = "int64",
				description = "The version the form read; left out for a new offer.") @Nullable Long version) {
}
