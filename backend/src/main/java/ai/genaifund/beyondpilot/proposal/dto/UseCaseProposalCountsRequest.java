package ai.genaifund.beyondpilot.proposal.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.Parameter;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

/** Which use cases to count the proposals of. */
public record UseCaseProposalCountsRequest(
		@Parameter(description = "The use cases to count, at most 50.", required = true) @NotEmpty @Size(
				max = 50) List<UUID> useCaseIds) {
}
