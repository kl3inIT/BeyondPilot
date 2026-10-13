package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

@Schema(name = "DecideUseCaseProposal", description = "What the organization that posted a use case decides on a proposal it received. Nobody is told until the outcomes are sent.")
public record DecideUseCaseProposalRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "shortlisted", "declined" }) @NotNull @Pattern(
				regexp = "shortlisted|declined") String decision) {
}
