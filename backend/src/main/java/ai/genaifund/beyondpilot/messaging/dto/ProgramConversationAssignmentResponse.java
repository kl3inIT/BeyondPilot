package ai.genaifund.beyondpilot.messaging.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ProgramConversationAssignment", description = "Program conversation assignment metadata; message content and sender are omitted.")
public record ProgramConversationAssignmentResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String programName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }) @Nullable UUID assigneeId) {
}
