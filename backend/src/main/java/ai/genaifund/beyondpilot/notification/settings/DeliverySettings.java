package ai.genaifund.beyondpilot.notification.settings;

import java.util.Optional;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import ai.genaifund.beyondpilot.notification.adapter.EmailConnection;
import ai.genaifund.beyondpilot.notification.adapter.EmailProvider;
import ai.genaifund.beyondpilot.notification.persistence.EmailSettings;
import ai.genaifund.beyondpilot.notification.persistence.EmailSettingsRepository;
import ai.genaifund.beyondpilot.notification.template.Appearance;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reads the email settings for sending: who delivers, with which connection, and as whom. Secrets are opened here and
 * only for the send that asks.
 */
@Component
public class DeliverySettings {

	/**
	 * Everything a send needs.
	 * @param replyTo where answers go; null to the sender
	 */
	public record Delivery(EmailConnection connection, String fromName, String fromAddress, @Nullable String replyTo) {

		public EmailProvider provider() {
			return connection.provider();
		}

	}

	private final EmailSettingsRepository settings;

	private final SecretBox secrets;

	private final NotificationProperties properties;

	DeliverySettings(EmailSettingsRepository settings, SecretBox secrets, NotificationProperties properties) {
		this.settings = settings;
		this.secrets = secrets;
		this.properties = properties;
	}

	/**
	 * How to send now; empty when no provider is chosen, a field it needs is missing, or its secret cannot be read
	 * because the encryption key is not configured.
	 */
	@Transactional(readOnly = true)
	public Optional<Delivery> delivery() {
		EmailSettings row = settings.current();
		if (row.getProvider() == null || row.getFromAddress() == null) {
			return Optional.empty();
		}
		String fromName = row.getFromName() == null ? "BeyondPilot" : row.getFromName();
		return connection(row)
			.map(connection -> new Delivery(connection, fromName, row.getFromAddress(), row.getReplyTo()));
	}

	/**
	 * How the providers' reports are recognised.
	 * @param resendWebhookSecret the secret Resend signs with, opened; null when none is stored or it cannot be read
	 * @param sesRegion the region whose SNS certificates sign SES reports; null when none is set
	 * @param sesEventsTopicArn the only SNS topic whose reports are accepted; null when none is set
	 */
	public record Reporting(@Nullable String resendWebhookSecret, @Nullable String sesRegion,
			@Nullable String sesEventsTopicArn) {

		@Override
		public String toString() {
			return "Reporting[sesRegion=" + sesRegion + ", sesEventsTopicArn=" + sesEventsTopicArn + "]";
		}

	}

	@Transactional(readOnly = true)
	public Reporting reporting() {
		EmailSettings row = settings.current();
		return new Reporting(secrets.open(row.getResendWebhookSecret()).orElse(null), row.getSesRegion(),
				row.getSesEventsTopicArn());
	}

	/** What the layout of every email takes from the settings and the site. */
	@Transactional(readOnly = true)
	public Appearance appearance() {
		EmailSettings row = settings.current();
		return new Appearance(row.getAccentColor() == null ? Appearance.DEFAULT_ACCENT : row.getAccentColor(),
				row.getFooter() == null ? Appearance.DEFAULT_FOOTER : row.getFooter(), properties.siteUrl());
	}

	private Optional<EmailConnection> connection(EmailSettings row) {
		EmailProvider provider = EmailProvider.of(row.getProvider()).orElseThrow();
		return switch (provider) {
			case SMTP -> {
				if (row.getSmtpHost() == null || row.getSmtpPort() == null) {
					yield Optional.empty();
				}
				String username = row.getSmtpUsername();
				Optional<String> password = secrets.open(row.getSmtpPassword());
				if (username != null && password.isEmpty()) {
					yield Optional.empty();
				}
				yield Optional.of(new EmailConnection.SmtpConnection(row.getSmtpHost(), row.getSmtpPort(), username,
						password.orElse(null), EmailConnection.SmtpSecurity.of(row.getSmtpSecurity())));
			}
			case SES -> {
				Optional<String> secret = secrets.open(row.getSesSecretAccessKey());
				if (row.getSesRegion() == null || row.getSesAccessKeyId() == null || secret.isEmpty()) {
					yield Optional.empty();
				}
				yield Optional.of(new EmailConnection.SesConnection(row.getSesRegion(), row.getSesAccessKeyId(),
						secret.get(), row.getSesConfigurationSet()));
			}
			case RESEND -> secrets.open(row.getResendApiKey()).map(EmailConnection.ResendConnection::new);
		};
	}

}
