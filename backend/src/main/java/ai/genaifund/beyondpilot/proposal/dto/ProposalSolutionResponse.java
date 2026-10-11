package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposalSolution", description = "A solution a proposal offers, as its review stands now.")
public record ProposalSolutionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
		@Schema(types = { "string", "null" }) @Nullable String summary,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "draft", "in_review", "needs_changes", "approved", "rejected" }) String status) {
}
