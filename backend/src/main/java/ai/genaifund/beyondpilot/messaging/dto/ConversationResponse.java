package ai.genaifund.beyondpilot.messaging.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "Conversation", description = "A conversation as the caller's list shows it.")
public record ConversationResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "talent", "solution", "program" },
				description = "Who the conversation is with: the person behind a talent profile, the organization that offers a solution, or GenAI Fund about a program.") String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "pending", "accepted", "declined", "closed" },
				description = "Where it stands. A request the other side reported reads as declined.") String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "starter", "recipient" },
				description = "Whether the caller wrote first or is the side written to.") String side,
		@Schema(types = { "string", "null" },
				description = "The other side as it is shown: a person or an organization. Null for GenAI Fund, and for a person who gave no name.") @Nullable String counterpartName,
		@Schema(types = { "string", "null" },
				description = "The organization of the person who wrote first, for the side written to; null when they had none.") @Nullable String counterpartOrganization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "What it is about: the name of the profile, solution or program when it started.") String subjectName,
		@Schema(types = { "object", "null" }) @Nullable LastMessageResponse lastMessage,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "When the last message was written, which orders the list.") Instant lastMessageAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "How many messages of the other side the caller has not read; 0 for a request.") int unread,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller may accept, decline or report it now.") boolean canAnswer,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "Whether the caller may write in it now.") boolean canWrite,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When a request closes if nobody answers; null once it is answered.") @Nullable Instant closesAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt) {
}
