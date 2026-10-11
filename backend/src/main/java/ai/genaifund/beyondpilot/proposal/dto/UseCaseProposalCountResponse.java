package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseProposalCount", description = "How many proposals one use case received.")
public record UseCaseProposalCountResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID useCaseId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64") long received) {
}
