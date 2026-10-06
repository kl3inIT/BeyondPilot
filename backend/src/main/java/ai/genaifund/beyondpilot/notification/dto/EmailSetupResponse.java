package ai.genaifund.beyondpilot.notification.dto;

import java.time.Instant;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import org.jspecify.annotations.Nullable;

@Schema(name = "EmailSetup",
		description = "What the saved provider says about whether email from the sender's domain can leave, read from its API just now.")
public record EmailSetupResponse(
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ses", "resend", "smtp" }) String provider,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The domain of the sender's address.") String domain,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant checkedAt,
		@Schema(types = { "string", "null" }, allowableValues = { "permission_missing", "credentials_refused", "unreachable" },
				description = "Why the provider could not be asked everything; null when it answered.") @Nullable String limit,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Each step the provider answered, in order. Empty for SMTP, which has no API to ask.") List<Check> checks,
		@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The DNS records the domain must hold.") List<DnsRecord> records) {

	@Schema(name = "EmailSetupCheck")
	public record Check(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED,
					allowableValues = { "credentials", "domain_added", "domain_verified", "dkim", "mail_from", "production_access", "sending_enabled" }) String step,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ok", "pending", "failed", "unknown" }) String state) {
	}

	@Schema(name = "EmailSetupDnsRecord")
	public record DnsRecord(
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "dkim, spf, mail_from, dmarc, or the provider's own word.") String purpose,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "TXT") String type,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The name relative to the domain, as DNS hosts ask for it; @ for the domain itself.") String host,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED) String value,
			@Schema(types = { "integer", "null" }, description = "The MX priority; null for any other type.") @Nullable Integer priority,
			@Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = { "ok", "pending", "failed", "unknown" },
					description = "Whether the provider found it; unknown for a record it does not look for.") String state) {
	}

}
