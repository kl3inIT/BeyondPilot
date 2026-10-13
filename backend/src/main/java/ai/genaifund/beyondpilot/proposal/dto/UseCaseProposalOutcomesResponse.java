package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseProposalOutcomes", description = "How many senders were e-mailed their outcome.")
public record UseCaseProposalOutcomesResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "E-mails queued: one for each proposal.") int sent,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Of them, told they were shortlisted.") int shortlisted,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Of them, told they were declined.") int declined) {
}
