package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailSuppression", description = "An address BeyondPilot does not send to, and why.")
public record EmailSuppressionResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String address,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "bounce", "complaint", "manual" }) String reason, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, description = "The operator who added it by hand.") @Nullable String createdBy,
		@Schema(types = { "string", "null" }, format = "uuid", description = "The email that caused it.") @Nullable UUID messageId,
		@Schema(types = { "string", "null" }, description = "The kind of that email.") @Nullable String messageKind) {
}
