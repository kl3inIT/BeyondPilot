package ai.genaifund.beyondpilot.usecase.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "UseCaseAccessCandidate", description = "A member of the organization who can be given access to a use case.")
public record UseCaseAccessCandidateResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Their name, or their address until they have a name.") String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email) {
}
