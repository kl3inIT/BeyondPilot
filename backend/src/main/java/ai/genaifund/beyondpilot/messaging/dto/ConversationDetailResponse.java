package ai.genaifund.beyondpilot.messaging.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(name = "ConversationDetail",
		description = "One conversation: its latest messages, what it is about and who is on the other side.")
public record ConversationDetailResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) ConversationResponse conversation,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The latest messages, the oldest first, at most 50.") List<MessageResponse> messages,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether messages earlier than these exist.") boolean hasEarlier,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How far the other side has read: the seq of the last message they read, 0 when none.") long readByOtherSide,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) SubjectResponse subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Who reads and answers on the other side. Empty for GenAI Fund, whose programs team reads.") List<ParticipantResponse> participants) {
}
