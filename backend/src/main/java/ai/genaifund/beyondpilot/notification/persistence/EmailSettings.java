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

	private byte @Nullable [] resendApiKey;

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
