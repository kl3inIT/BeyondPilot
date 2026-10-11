package ai.genaifund.beyondpilot.proposal.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "TeamCandidate", description = "A member of the caller's organization the proposal may name.")
public record TeamCandidateResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether this is the caller.") boolean self) {
}
