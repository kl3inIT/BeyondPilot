package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ConversationProspect",
		description = "What the caller would write to before the first message is sent: who reads it and what it is about.")
public record ProspectResponse(
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The conversation the caller already has with this subject while it waits or is open; null when none.") @Nullable UUID conversationId,
		@Schema(types = { "string", "null" },
				description = "The other side as it is shown; null for GenAI Fund.") @Nullable String counterpartName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the first message waits as a request until the other side accepts it.") boolean request,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SubjectResponse subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<ParticipantResponse> participants) {
}
