package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailMessageSummary", description = "One email in the log.")
public record EmailMessageSummaryResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String recipient, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String subject,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "queued", "sent", "delivered", "bounced", "complained", "failed", "skipped" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int attempts,
		@Schema(types = { "string", "null" }, description = "The typed reason of the last failure.") @Nullable String lastError) {
}
