package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProposalTeamMember", description = "One person a proposal names, with the role typed for it.")
public record ProposalTeamMemberResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean primary) {
}
