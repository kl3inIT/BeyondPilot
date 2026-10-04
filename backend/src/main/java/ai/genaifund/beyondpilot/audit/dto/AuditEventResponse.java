package ai.genaifund.beyondpilot.audit.dto;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import ai.genaifund.beyondpilot.audit.AuditAction;
import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "AuditEvent", description = "One recorded change: who did what to what, and when.")
public record AuditEventResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant occurredAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) AuditAction action,
		@Schema(types = { "object", "null" },
				description = "Who did it; null when the server configuration did.") @Nullable Actor actor,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Resource resource,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The fields the action declares, each as text.") Map<String, String> details,
		@Schema(types = { "string", "null" }, format = "uuid",
				description = "The request that made the change, as logged and returned in X-Request-Id.") @Nullable UUID requestId) {

	@Schema(name = "AuditEventActor", description = "The person who acted, as they were named at that moment.")
	public record Actor(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String email) {
	}

	@Schema(name = "AuditEventResource", description = "What was acted on, with the name it had at that moment.")
	public record Resource(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String label) {
	}

}
