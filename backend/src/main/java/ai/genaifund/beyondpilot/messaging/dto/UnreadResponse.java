package ai.genaifund.beyondpilot.messaging.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "Unread", description = "What waits for the caller in Messages.")
public record UnreadResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many messages the caller has not read across the open conversations.") int unread,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many first messages wait for the caller's side to answer.") int requests) {
}
