package ai.genaifund.beyondpilot.messaging.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "LastMessage", description = "The last message of a conversation, as its row in the list shows it.")
public record LastMessageResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The start of the message, at most 140 characters.") String preview,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the caller wrote it.") boolean mine,
		@Schema(types = { "string", "null" },
				description = "Who wrote it, as they are shown; null until they gave a name.") @Nullable String senderName) {
}
