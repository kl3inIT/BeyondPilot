package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ConversationList",
		description = "The caller's conversations, the one written in last first, in the two lists the screen shows.")
public record ConversationListResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The conversations that are open, and every one the caller started.") List<ConversationResponse> chats,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The first messages that wait for the caller's side to answer.") List<ConversationResponse> requests,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many messages the caller has not read across the open conversations.") int unread) {
}
