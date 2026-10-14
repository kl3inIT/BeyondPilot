package ai.genaifund.beyondpilot.messaging.dto;

import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConversationMember", description = "A member of the caller's organization whom its owner may add to this conversation.")
public record ConversationMemberResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID accountId,
		@Schema(types = { "string", "null" }) @Nullable String name,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean included) {
}
