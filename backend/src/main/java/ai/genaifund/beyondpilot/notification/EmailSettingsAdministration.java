package ai.genaifund.beyondpilot.notification;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import ai.genaifund.beyondpilot.audit.AuditAction;
import ai.genaifund.beyondpilot.audit.AuditRecord;
import ai.genaifund.beyondpilot.audit.AuditTrail;
import ai.genaifund.beyondpilot.identity.Actor;
import ai.genaifund.beyondpilot.identity.IdentityService;
import ai.genaifund.beyondpilot.identity.Operator;
import ai.genaifund.beyondpilot.notification.adapter.EmailConnection;
import ai.genaifund.beyondpilot.notification.adapter.EmailDeliveryException.DeliveryFailure;
import ai.genaifund.beyondpilot.notification.delivery.EmailDelivery;
import ai.genaifund.beyondpilot.notification.dto.EmailSettingsResponse;
import ai.genaifund.beyondpilot.notification.dto.EmailTestResponse;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailAppearanceRequest;
import ai.genaifund.beyondpilot.notification.dto.SaveEmailSettingsRequest;
import ai.genaifund.beyondpilot.notification.persistence.EmailSettings;
import ai.genaifund.beyondpilot.notification.persistence.EmailSettingsRepository;
import ai.genaifund.beyondpilot.notification.settings.DeliverySettings;
import ai.genaifund.beyondpilot.notification.settings.SecretBox;
import ai.genaifund.beyondpilot.notification.template.Appearance;
import ai.genaifund.beyondpilot.notification.template.EmailRenderer;
import ai.genaifund.beyondpilot.notification.template.EmailTemplate;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * What operators do with the email settings: read them, choose who delivers and as whom, test a connection before
 * saving it, and set the appearance of every email. Secrets go in sealed and never come out.
 *
 * <p>
 * A stored secret is kept when the form leaves it empty, but only while the server, account or key it belongs to is
 * unchanged (Keycloak's rule): otherwise an operator could point the settings, or a test, at a server of their own
 * and receive the stored password.
 */
@Service
public class EmailSettingsAdministration {

	private static final String RESOURCE = "email_settings";

	private static final EmailTemplate TEST = new EmailTemplate("BeyondPilot email works",
			"# Email works\n\nThis test came through the provider set in Admin › Email. Email from BeyondPilot will reach its"
					+ " recipients the same way.");

	private final IdentityService identity;

	private final EmailSettingsRepository settings;

	private final SecretBox secrets;

	private final DeliverySettings delivery;

	private final EmailRenderer renderer;

	private final EmailDelivery sender;

	private final AuditTrail audit;

	EmailSettingsAdministration(IdentityService identity, EmailSettingsRepository settings, SecretBox secrets,
			DeliverySettings delivery, EmailRenderer renderer, EmailDelivery sender, AuditTrail audit) {
		this.identity = identity;
		this.settings = settings;
		this.secrets = secrets;
		this.delivery = delivery;
		this.renderer = renderer;
		this.sender = sender;
		this.audit = audit;
	}

	/**
	 * The settings as the Settings screen shows them.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 */
	@Transactional(readOnly = true)
	public EmailSettingsResponse get(Actor actor) {
		identity.requireOperator(actor);
		return response(settings.current());
	}

	/**
	 * Saves who delivers email and as whom.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when the settings changed since they were read, a field the provider needs is
	 * missing, or a secret is given while the server has no key to seal it
	 */
	@Transactional
	public EmailSettingsResponse save(Actor actor, SaveEmailSettingsRequest request) {
		Operator operator = identity.requireOperator(actor);
		EmailSettings row = settings.current();
		if (row.getVersion() != request.version()) {
			throw new NotificationException(NotificationErrorCode.SETTINGS_CHANGED,
					"Email settings read at version " + request.version() + ", now " + row.getVersion());
		}
		Secrets kept = kept(row, request);
		connection(request, kept);
		row.deliverWith(request.provider(), request.fromName().strip(), request.fromAddress().strip(),
				blankToNull(request.replyTo()), blankToNull(request.smtp().host()), request.smtp().port(),
				blankToNull(request.smtp().username()), kept.smtpPassword(), request.smtp().security(),
				blankToNull(request.ses().region()), blankToNull(request.ses().accessKeyId()), kept.sesSecretAccessKey(),
				blankToNull(request.ses().configurationSet()), kept.resendApiKey());
		row.reportWith(blankToNull(request.ses().eventsTopicArn()),
				secret(request.resend().webhookSecret(), row.getResendWebhookSecret()));
		row.changedBy(operator.accountId(), operator.label(), Instant.now());
		EmailSettings saved = settings.saveAndFlush(row);
		record(AuditAction.EMAIL_SETTINGS_UPDATE, operator, Map.of("provider", request.provider()));
		return response(saved);
	}

	/**
	 * Sets the accent colour and the footer note of every email.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when the settings changed since they were read
	 */
	@Transactional
	public EmailSettingsResponse saveAppearance(Actor actor, SaveEmailAppearanceRequest request) {
		Operator operator = identity.requireOperator(actor);
		EmailSettings row = settings.current();
		if (row.getVersion() != request.version()) {
			throw new NotificationException(NotificationErrorCode.SETTINGS_CHANGED,
					"Email settings read at version " + request.version() + ", now " + row.getVersion());
		}
		row.appearWith(request.accentColor().toUpperCase(Locale.ROOT), request.footer().strip());
		row.changedBy(operator.accountId(), operator.label(), Instant.now());
		EmailSettings saved = settings.saveAndFlush(row);
		record(AuditAction.EMAIL_APPEARANCE_UPDATE, operator, Map.of());
		return response(saved);
	}

	/**
	 * Sends a test through the settings as the form holds them, saved or not, to the operator's own address.
	 * @throws ai.genaifund.beyondpilot.identity.IdentityException when the caller is not an operator
	 * @throws NotificationException when a field the provider needs is missing
	 */
	@Transactional(propagation = Propagation.NOT_SUPPORTED)
	public EmailTestResponse test(Actor actor, SaveEmailSettingsRequest request) {
		Operator operator = identity.requireOperator(actor);
		EmailSettings row = settings.current();
		EmailConnection connection = connection(request, kept(row, request));
		DeliverySettings.Delivery draft = new DeliverySettings.Delivery(connection, request.fromName().strip(),
				request.fromAddress().strip(), blankToNull(request.replyTo()));
		Optional<DeliveryFailure> failure = sender.sendTest(draft, operator.email(),
				renderer.render(TEST, delivery.appearance()));
		return new EmailTestResponse(operator.email(), failure.isEmpty(), failure.map(DeliveryFailure::value).orElse(null));
	}

	/** The sealed secrets to store: a new one sealed, an empty one kept while what it belongs to is unchanged. */
	private Secrets kept(EmailSettings row, SaveEmailSettingsRequest request) {
		boolean sameSmtp = Objects.equals(row.getSmtpHost(), blankToNull(request.smtp().host()))
				&& Objects.equals(row.getSmtpPort(), request.smtp().port())
				&& Objects.equals(row.getSmtpUsername(), blankToNull(request.smtp().username()));
		boolean sameSes = Objects.equals(row.getSesRegion(), blankToNull(request.ses().region()))
				&& Objects.equals(row.getSesAccessKeyId(), blankToNull(request.ses().accessKeyId()));
		return new Secrets(secret(request.smtp().password(), sameSmtp ? row.getSmtpPassword() : null),
				secret(request.ses().secretAccessKey(), sameSes ? row.getSesSecretAccessKey() : null),
				secret(request.resend().apiKey(), row.getResendApiKey()));
	}

	private byte @Nullable [] secret(@Nullable String given, byte @Nullable [] stored) {
		if (given == null || given.isBlank()) {
			return stored;
		}
		if (!secrets.open()) {
			throw new NotificationException(NotificationErrorCode.ENCRYPTION_KEY_MISSING,
					"A secret was given but BEYONDPILOT_NOTIFICATION_ENCRYPTION_KEY is not set");
		}
		return secrets.seal(given.strip());
	}

	/** The connection the request describes for its provider, with the secrets to use. */
	private EmailConnection connection(SaveEmailSettingsRequest request, Secrets kept) {
		try {
			return switch (request.provider()) {
				case "smtp" -> {
					SaveEmailSettingsRequest.Smtp smtp = request.smtp();
					String username = blankToNull(smtp.username());
					String password = secrets.open(kept.smtpPassword()).orElse(null);
					if (blankToNull(smtp.host()) == null || smtp.port() == null || (username != null && password == null)) {
						throw incomplete("smtp");
					}
					yield new EmailConnection.SmtpConnection(smtp.host().strip(), smtp.port(), username,
							username == null ? null : password, EmailConnection.SmtpSecurity.of(smtp.security()));
				}
				case "ses" -> {
					SaveEmailSettingsRequest.Ses ses = request.ses();
					String secret = secrets.open(kept.sesSecretAccessKey()).orElse(null);
					if (blankToNull(ses.region()) == null || blankToNull(ses.accessKeyId()) == null || secret == null) {
						throw incomplete("ses");
					}
					yield new EmailConnection.SesConnection(ses.region(), ses.accessKeyId().strip(), secret,
							blankToNull(ses.configurationSet()));
				}
				default -> new EmailConnection.ResendConnection(
						secrets.open(kept.resendApiKey()).orElseThrow(() -> incomplete("resend")));
			};
		}
		catch (IllegalArgumentException invalid) {
			throw incomplete(request.provider());
		}
	}

	private EmailSettingsResponse response(EmailSettings row) {
		Appearance appearance = delivery.appearance();
		return new EmailSettingsResponse(row.getProvider(), row.getFromName(), row.getFromAddress(), row.getReplyTo(),
				new EmailSettingsResponse.Smtp(row.getSmtpHost(), row.getSmtpPort(), row.getSmtpUsername(),
						row.getSmtpSecurity(), row.getSmtpPassword() != null),
				new EmailSettingsResponse.Ses(row.getSesRegion(), row.getSesAccessKeyId(), row.getSesConfigurationSet(),
						row.getSesEventsTopicArn(), row.getSesSecretAccessKey() != null,
						appearance.siteUrl() + "/api/notification/email/events/ses"),
				new EmailSettingsResponse.Resend(row.getResendApiKey() != null, row.getResendWebhookSecret() != null,
						appearance.siteUrl() + "/api/notification/email/events/resend"),
				delivery.delivery().isPresent(),
				secrets.open(), appearance.accentColor(), appearance.footer(), row.getUpdatedByLabel(),
				row.getUpdatedBy() == null ? null : row.getUpdatedAt(), row.getVersion());
	}

	private void record(AuditAction action, Operator operator, Map<String, String> details) {
		audit.record(new AuditRecord(action,
				new AuditRecord.Actor(operator.accountId(), operator.label(), operator.email()),
				new AuditRecord.Resource(RESOURCE, "1", "Email settings"), details));
	}

	private static NotificationException incomplete(String provider) {
		return new NotificationException(NotificationErrorCode.SETTINGS_INCOMPLETE,
				"The " + provider + " settings lack a field or a secret");
	}

	private static @Nullable String blankToNull(@Nullable String value) {
		return value == null || value.isBlank() ? null : value.strip();
	}

	private record Secrets(byte @Nullable [] smtpPassword, byte @Nullable [] sesSecretAccessKey,
			byte @Nullable [] resendApiKey) {
	}

}
