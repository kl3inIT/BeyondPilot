package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "MessagePage", description = "Some messages of a conversation, the oldest first.")
public record MessagePageResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MessageResponse> messages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether more messages exist in the direction asked for.") boolean hasMore,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How far the other side has read: the seq of the last message they read, 0 when none.") long readByOtherSide) {
}
