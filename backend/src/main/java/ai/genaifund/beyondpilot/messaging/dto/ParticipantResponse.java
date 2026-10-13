package ai.genaifund.beyondpilot.messaging.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConversationParticipant", description = "A person on the other side of a conversation.")
public record ParticipantResponse(
		@Schema(types = { "string", "null" },
				description = "The person as they are shown; null until they gave a name.") @Nullable String name,
		@Schema(types = { "string", "null" },
				description = "The organization they act for; null when none.") @Nullable String organizationName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "person", "owner", "member" },
				description = "A person on their own, or an owner or a member of the organization written to.") String role) {
}
