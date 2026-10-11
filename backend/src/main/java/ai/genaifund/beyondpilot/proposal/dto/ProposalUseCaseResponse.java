package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposalUseCase", description = "The use case a proposal is for.")
public record ProposalUseCaseResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant closesAt) {
}
