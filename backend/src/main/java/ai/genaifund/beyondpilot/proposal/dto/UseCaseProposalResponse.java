package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "UseCaseProposal", description = "An organization's proposal to a use case as its members see it: the working copy, or the proposal as sent.")
public record UseCaseProposalResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "draft", "sent" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The solutions offered, in the order shown.") List<ProposalSolutionResponse> solutions,
		@Schema(types = { "string", "null" }) @Nullable String approach,
		@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ProposalTeamMemberResponse> team,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant sentAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "int64",
				description = "Sent back with the next save, so a save made on a stale copy is refused.") long version,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant updatedAt) {
}
