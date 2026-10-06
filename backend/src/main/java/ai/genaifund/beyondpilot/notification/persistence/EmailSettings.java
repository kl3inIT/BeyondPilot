package ai.genaifund.beyondpilot.notification.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import org.jspecify.annotations.Nullable;

/** The one row of email settings. Secrets are stored sealed; this entity never holds one in clear. */
@Entity
@Table(name = "email_settings")
public class EmailSettings {

	public static final short ID = 1;

	@Id
	private short id;

	private @Nullable String provider;

	private @Nullable String fromName;

	private @Nullable String fromAddress;

	private @Nullable String replyTo;

	private @Nullable String smtpHost;

	private @Nullable Integer smtpPort;

	private @Nullable String smtpUsername;

	private byte @Nullable [] smtpPassword;

	@Column(nullable = false)
	private String smtpSecurity;

	private @Nullable String sesRegion;

	private @Nullable String sesAccessKeyId;

	private byte @Nullable [] sesSecretAccessKey;

	private @Nullable String sesConfigurationSet;

	private @Nullable String sesEventsTopicArn;

	private byte @Nullable [] resendApiKey;

	private byte @Nullable [] resendWebhookSecret;

	private @Nullable String accentColor;

	private @Nullable String footer;

	@Version
	private long version;

	private @Nullable UUID updatedBy;

	private @Nullable String updatedByLabel;

	@Column(nullable = false)
	private Instant updatedAt;

	protected EmailSettings() {
		this.smtpSecurity = "starttls";
		this.updatedAt = Instant.EPOCH;
	}

	/**
	 * Replaces who delivers email and as whom. Secrets are passed sealed: a null one is cleared.
	 */
	public void deliverWith(String provider, String fromName, String fromAddress, @Nullable String replyTo,
			@Nullable String smtpHost, @Nullable Integer smtpPort, @Nullable String smtpUsername,
			byte @Nullable [] smtpPassword, String smtpSecurity, @Nullable String sesRegion,
			@Nullable String sesAccessKeyId, byte @Nullable [] sesSecretAccessKey, @Nullable String sesConfigurationSet,
			byte @Nullable [] resendApiKey) {
		this.provider = provider;
		this.fromName = fromName;
		this.fromAddress = fromAddress;
		this.replyTo = replyTo;
		this.smtpHost = smtpHost;
		this.smtpPort = smtpPort;
		this.smtpUsername = smtpUsername;
		this.smtpPassword = smtpPassword;
		this.smtpSecurity = smtpSecurity;
		this.sesRegion = sesRegion;
		this.sesAccessKeyId = sesAccessKeyId;
		this.sesSecretAccessKey = sesSecretAccessKey;
		this.sesConfigurationSet = sesConfigurationSet;
		this.resendApiKey = resendApiKey;
	}

	/**
	 * Sets how the providers' reports are recognised: the SNS topic Amazon SES reports to and the secret Resend signs
	 * with, sealed. A null secret is cleared.
	 */
	public void reportWith(@Nullable String sesEventsTopicArn, byte @Nullable [] resendWebhookSecret) {
		this.sesEventsTopicArn = sesEventsTopicArn;
		this.resendWebhookSecret = resendWebhookSecret;
	}

	public void appearWith(String accentColor, String footer) {
		this.accentColor = accentColor;
		this.footer = footer;
	}

	/** Records who changed the settings, as they were named, and when. */
	public void changedBy(UUID accountId, String label, Instant at) {
		this.updatedBy = accountId;
		this.updatedByLabel = label;
		this.updatedAt = at;
	}

	public @Nullable String getProvider() {
		return provider;
	}

	public @Nullable String getFromName() {
		return fromName;
	}

	public @Nullable String getFromAddress() {
		return fromAddress;
	}

	public @Nullable String getReplyTo() {
		return replyTo;
	}

	public @Nullable String getSmtpHost() {
		return smtpHost;
	}

	public @Nullable Integer getSmtpPort() {
		return smtpPort;
	}

	public @Nullable String getSmtpUsername() {
		return smtpUsername;
	}

	public byte @Nullable [] getSmtpPassword() {
		return smtpPassword;
	}

	public String getSmtpSecurity() {
		return smtpSecurity;
	}

	public @Nullable String getSesRegion() {
		return sesRegion;
	}

	public @Nullable String getSesAccessKeyId() {
		return sesAccessKeyId;
	}

	public byte @Nullable [] getSesSecretAccessKey() {
		return sesSecretAccessKey;
	}

	public @Nullable String getSesConfigurationSet() {
		return sesConfigurationSet;
	}

	public byte @Nullable [] getResendApiKey() {
		return resendApiKey;
	}

	public @Nullable String getSesEventsTopicArn() {
		return sesEventsTopicArn;
	}

	public byte @Nullable [] getResendWebhookSecret() {
		return resendWebhookSecret;
	}

	public @Nullable String getAccentColor() {
		return accentColor;
	}

	public @Nullable String getFooter() {
		return footer;
	}

	public long getVersion() {
		return version;
	}

	public @Nullable UUID getUpdatedBy() {
		return updatedBy;
	}

	public @Nullable String getUpdatedByLabel() {
		return updatedByLabel;
	}

	public Instant getUpdatedAt() {
		return updatedAt;
	}

}
