package ai.genaifund.beyondpilot.proposal.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Reviewer",
		description = "Someone who scores a program's applications: a judge GenAI Fund invited, or an operator who scored one.")
public record ReviewerResponse(
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The invitation; null for an operator, who needs none.") @Nullable UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "operator", "reviewer" }) String role,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "active", "invited", "lapsed" },
				description = "A judge is active once they signed in with the address; an invitation nobody used lapses.") String status,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant invitedAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant expiresAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many submitted applications they scored or stepped back from.") long assessed) {
}
