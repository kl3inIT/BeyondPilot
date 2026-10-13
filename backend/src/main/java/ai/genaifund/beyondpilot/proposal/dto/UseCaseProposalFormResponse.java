package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCaseProposalForm", description = "What the proposal form needs: the use case, the caller's organization, and the proposal if one was saved.")
public record UseCaseProposalFormResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ProposalUseCaseResponse useCase,
		@Schema(types = { "object", "null" }, description = "Null when the caller belongs to no organization.") @Nullable ProposingOrganizationResponse organization,
		@Schema(types = { "object", "null" }, description = "Null until something was saved.") @Nullable UseCaseProposalResponse proposal) {
}
