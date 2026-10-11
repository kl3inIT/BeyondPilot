package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReceivedUseCaseProposal", description = "One proposal a use case received, as the members of the organization that posted it read it.")
public record ReceivedUseCaseProposalResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ProposalUseCaseResponse useCase,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String organizationName,
		@Schema(types = { "string", "null" }, format = "uuid", description = "Read at /api/storage/files/{id}.") @Nullable UUID organizationLogoFileId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ProposalSolutionResponse> solutions,
		@Schema(types = { "string", "null" }) @Nullable String approach,
		@Schema(types = { "object", "null" }) @Nullable SenderProfileResponse sender,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ProposalTeamMemberResponse> team,
		@Schema(types = { "object", "null" }) @Nullable AttachedFileResponse deck,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, format = "date-time") Instant sentAt) {
}
