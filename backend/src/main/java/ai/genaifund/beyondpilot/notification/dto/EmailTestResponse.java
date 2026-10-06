package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailTest", description = "How a test email went. It is sent to the operator who asked, and to nobody else.")
public record EmailTestResponse(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String recipient, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean sent,
		@Schema(types = { "string", "null" },
				allowableValues = { "not_configured", "authentication", "throttled", "unavailable", "rejected", "invalid_recipient" },
				description = "Why it was not sent; null when it was.") @Nullable String failure) {
}
