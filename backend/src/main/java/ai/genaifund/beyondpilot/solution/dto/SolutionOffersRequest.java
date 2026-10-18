package ai.genaifund.beyondpilot.solution.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "SetSolutionOffers", description = "The offers a solution comes with, as an operator chooses them.")
public record SolutionOffersRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Offers its organization gives; empty for none.") @NotNull @Size(
						max = SolutionCodes.MAX_OFFERS) List<@NotNull UUID> offerIds) {
}
