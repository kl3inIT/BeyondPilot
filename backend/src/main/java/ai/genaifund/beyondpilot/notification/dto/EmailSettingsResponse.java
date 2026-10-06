package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailSettings",
		description = "Who delivers BeyondPilot's email and as whom. Secrets are never returned: each says only whether it is set.")
public record EmailSettingsResponse(
		@Schema(types = { "string", "null" }, allowableValues = { "ses", "resend", "smtp" },
				description = "The provider chosen; null until an operator chooses one, and email waits meanwhile.") @Nullable String provider,
		@Schema(types = { "string", "null" }) @Nullable String fromName,
		@Schema(types = { "string", "null" }) @Nullable String fromAddress,
		@Schema(types = { "string", "null" }) @Nullable String replyTo,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Smtp smtp, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Ses ses, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Resend resend,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether email can leave now: a provider is chosen and everything it needs is set.") boolean ready,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Whether the server holds the key that encrypts secrets; without it none can be saved.") boolean encryptionReady,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String accentColor, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String footer,
		@Schema(types = { "string", "null" }, description = "Who saved the settings last, as they were named.") @Nullable String updatedBy,
		@Schema(types = { "string", "null" }, format = "date-time") @Nullable Instant updatedAt,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Send it back with a change; a change made meanwhile is refused.") long version) {

	@Schema(name = "EmailSmtpSettings")
	public record Smtp(@Schema(types = { "string", "null" }) @Nullable String host,
			@Schema(types = { "integer", "null" }) @Nullable Integer port,
			@Schema(types = { "string", "null" }) @Nullable String username,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "starttls", "tls", "none" }) String security, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean passwordSet) {
	}

	@Schema(name = "EmailSesSettings")
	public record Ses(@Schema(types = { "string", "null" }) @Nullable String region,
			@Schema(types = { "string", "null" }) @Nullable String accessKeyId,
			@Schema(types = { "string", "null" }) @Nullable String configurationSet, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean secretAccessKeySet) {
	}

	@Schema(name = "EmailResendSettings")
	public record Resend(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean apiKeySet) {
	}

}
