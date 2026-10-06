package ai.genaifund.beyondpilot.notification.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/**
 * Who delivers email and as whom. A secret left empty keeps the one stored, unless the server, account or key it
 * belongs to changed: then it must be entered again, so a stored secret never goes to a server it was not given for.
 */
@Schema(name = "SaveEmailSettings", description = "Who delivers email and as whom. An empty secret keeps the stored one while what it belongs to is unchanged.")
public record SaveEmailSettingsRequest(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ses", "resend", "smtp" }) @NotNull @Pattern(regexp = "ses|resend|smtp") String provider,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Size(max = 80) String fromName,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotBlank @Email @Size(max = 254) String fromAddress,
		@Schema(types = { "string", "null" }) @Email @Size(max = 254) @Nullable String replyTo,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid Smtp smtp, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid Ses ses, @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull @Valid Resend resend,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The version the settings were read at.") long version) {

	@Schema(name = "SaveEmailSmtpSettings")
	public record Smtp(@Schema(types = { "string", "null" }) @Size(max = 253) @Nullable String host,
			@Schema(types = { "integer", "null" }) @Min(1) @Max(65535) @Nullable Integer port,
			@Schema(types = { "string", "null" }) @Size(max = 254) @Nullable String username,
			@Schema(types = { "string", "null" }, description = "Empty to keep the stored one.") @Size(max = 500) @Nullable String password,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "starttls", "tls", "none" }) @NotNull @Pattern(regexp = "starttls|tls|none") String security) {
	}

	@Schema(name = "SaveEmailSesSettings")
	public record Ses(@Schema(types = { "string", "null" }, example = "ap-southeast-1") @Pattern(regexp = "[a-z]{2}(-[a-z]+)+-\\d") @Nullable String region,
			@Schema(types = { "string", "null" }) @Size(max = 128) @Nullable String accessKeyId,
			@Schema(types = { "string", "null" }, description = "Empty to keep the stored one.") @Size(max = 256) @Nullable String secretAccessKey,
			@Schema(types = { "string", "null" }) @Size(max = 64) @Nullable String configurationSet,
			@Schema(types = { "string", "null" }, description = "The SNS topic the configuration set reports to.") @Pattern(regexp = "arn:aws[a-z-]*:sns:[a-z0-9-]+:[0-9]{12}:[A-Za-z0-9_-]{1,256}") @Nullable String eventsTopicArn) {
	}

	@Schema(name = "SaveEmailResendSettings")
	public record Resend(@Schema(types = { "string", "null" }, description = "Empty to keep the stored one.") @Size(max = 256) @Nullable String apiKey,
			@Schema(types = { "string", "null" }, description = "The secret Resend signs its webhooks with; empty to keep the stored one.") @Size(max = 256) @Nullable String webhookSecret) {
	}

}
