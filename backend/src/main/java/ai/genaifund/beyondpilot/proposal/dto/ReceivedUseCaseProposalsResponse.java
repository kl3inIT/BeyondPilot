package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ReceivedUseCaseProposals", description = "The proposals a use case received, the latest first.")
public record ReceivedUseCaseProposalsResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ProposalUseCaseResponse useCase,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ReceivedUseCaseProposalSummaryResponse> items,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many proposals are shortlisted.") int shortlisted,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many proposals are declined.") int declined,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "How many proposals have an outcome to send.") int pending) {
}
