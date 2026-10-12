package ai.genaifund.beyondpilot.solution.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "AdminOfferDetail", description = "An offer with the solutions that come with it, as an operator reads its record.")
public record AdminOfferDetailResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) AdminOfferResponse offer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The solutions that come with it, by name.") List<AdminOfferSolutionResponse> solutionList) {
}
