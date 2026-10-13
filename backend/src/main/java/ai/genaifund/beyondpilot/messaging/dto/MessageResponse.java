package ai.genaifund.beyondpilot.messaging.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Message", description = "One message of a conversation, as the caller reads it.")
public record MessageResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Its place among all messages; a later message has a greater one.") long seq,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String body,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the caller wrote it.") boolean mine,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the person who started the conversation wrote it; otherwise the side they wrote to did.") boolean fromStarter,
		@Schema(types = { "string", "null" },
				description = "Who wrote it, as they are shown; null until they gave a name.") @Nullable String senderName) {
}
