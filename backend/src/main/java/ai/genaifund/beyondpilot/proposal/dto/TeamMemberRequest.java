package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(name = "TeamMemberRequest", description = "One person of the organization the proposal names, with the role typed for it.")
public record TeamMemberRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull UUID accountId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What the person does on this proposal; a draft may leave it empty, a proposal cannot be sent with it empty.") @NotNull @Size(max = 80) String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the posting organization is told to speak to this person; at most one.") boolean primary) {
}
