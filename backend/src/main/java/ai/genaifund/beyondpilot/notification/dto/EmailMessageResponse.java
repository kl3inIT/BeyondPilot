package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailMessage", description = "One email as it was sent, with what happened to it.")
public record EmailMessageResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant sentAt, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String recipient,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String kind, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String subject, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String html, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String text,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "queued", "sent", "delivered", "bounced", "complained", "failed", "skipped" }) String status,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) int attempts,
		@Schema(types = { "string", "null" }, allowableValues = { "ses", "resend", "smtp" }) @Nullable String provider,
		@Schema(types = { "string", "null" }) @Nullable String providerMessageId,
		@Schema(types = { "string", "null" }) @Nullable String lastError, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Event> events,
		@Schema(types = { "object", "null" }, description = "Why the address is not sent to; null when it is.") @Nullable EmailSuppressionResponse suppression,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether an operator may send it again.") boolean resendable) {

	@Schema(name = "EmailEvent", description = "What the provider reported about the email.")
	public record Event(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "delivered", "bounced", "soft_bounced", "complained" }) String type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant occurredAt, @Schema(types = { "string", "null" }) @Nullable String detail) {
	}

}
