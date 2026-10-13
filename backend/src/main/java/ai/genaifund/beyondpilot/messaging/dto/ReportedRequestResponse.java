package ai.genaifund.beyondpilot.messaging.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "ReportedRequest", description = "A first message the side written to reported as unwanted.")
public record ReportedRequestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				allowableValues = { "talent", "solution", "program" }) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The profile or solution it was sent about.") String subjectName,
		@Schema(types = { "string", "null" },
				description = "The sender's name; null when they gave none.") @Nullable String senderName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
				description = "The sender's address; empty when the account no longer signs in.") String senderEmail,
		@Schema(types = { "string", "null" },
				description = "The organization the sender belonged to; null when none.") @Nullable String senderOrganization,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time",
				description = "When it was reported.") @Nullable Instant reportedAt) {
}
