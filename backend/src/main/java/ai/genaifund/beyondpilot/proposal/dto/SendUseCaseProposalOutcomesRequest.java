package ai.genaifund.beyondpilot.proposal.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

@Schema(name = "SendUseCaseProposalOutcomes", description = "Sends the outcomes of a use case's proposals that were decided and not yet told.")
public record SendUseCaseProposalOutcomesRequest(
		@Schema(types = { "string", "null" }, maxLength = 2000,
				description = "A note quoted in every e-mail sent; optional.") @Size(max = 2000) @Nullable String message) {
}
