package ai.genaifund.beyondpilot.notification;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import ai.genaifund.beyondpilot.notification.adapter.EmailProvider;
import ai.genaifund.beyondpilot.notification.delivery.DeliveryReport;
import ai.genaifund.beyondpilot.notification.delivery.DeliveryReports;
import ai.genaifund.beyondpilot.notification.settings.DeliverySettings;
import com.resend.core.exception.ResendException;
import com.resend.services.webhooks.Webhooks;
import com.resend.services.webhooks.model.VerifyWebhookOptions;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Takes in what providers report about sent email. Nothing is read before the report's signature is checked against
 * the settings: Resend's webhook secret, or the SNS signature of Amazon SES's topic. A report from any other topic is
 * refused, because anyone can make an SNS topic and sign reports with it.
 */
@Service
public class EmailEventIntake {

	private static final Logger LOG = LoggerFactory.getLogger(EmailEventIntake.class);

	private final DeliverySettings settings;

	private final DeliveryReports reports;

	private final JsonMapper json;

	private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

	private final SnsMessages sns;

	EmailEventIntake(DeliverySettings settings, DeliveryReports reports, JsonMapper json) {
		this.settings = settings;
		this.reports = reports;
		this.json = json;
		this.sns = new SnsMessages(json, http);
	}

	/**
	 * A webhook of Resend, signed the Svix way.
	 * @param headers the request's headers, named in lower case
	 * @throws NotificationException when no webhook secret is set or the signature does not match
	 */
	public void resend(Map<String, String> headers, String payload) {
		String secret = settings.reporting().resendWebhookSecret();
		if (secret == null) {
			throw refused("No Resend webhook secret is set");
		}
		try {
			new Webhooks("unused").verify(
					VerifyWebhookOptions.builder().payload(payload).addHeaders(headers).secret(secret).build());
		}
		catch (ResendException invalid) {
			throw refused("A Resend webhook did not verify");
		}
		JsonNode event = json.readTree(payload);
		DeliveryReport.Type type = switch (event.path("type").asString("")) {
			case "email.delivered" -> DeliveryReport.Type.DELIVERED;
			case "email.bounced" -> "Transient".equals(event.path("data").path("bounce").path("type").asString(""))
					? DeliveryReport.Type.SOFT_BOUNCED : DeliveryReport.Type.BOUNCED;
			case "email.complained" -> DeliveryReport.Type.COMPLAINED;
			default -> null;
		};
		String emailId = event.path("data").path("email_id").asString("");
		if (type == null || emailId.isEmpty()) {
			return;
		}
		reports.apply(new DeliveryReport(EmailProvider.RESEND, emailId, type, instant(event.path("created_at")),
				detail(event.path("data").path("bounce").path("subType")), headers.get("svix-id")));
	}

	/**
	 * A message of Amazon SNS carrying an event of SES's configuration set, or confirming the subscription.
	 * @throws NotificationException when no region or topic is set, the signature does not check, or the topic is not
	 * the one set
	 */
	public void ses(String payload) {
		DeliverySettings.Reporting reporting = settings.reporting();
		if (reporting.sesRegion() == null || reporting.sesEventsTopicArn() == null) {
			throw refused("No SES region or events topic is set");
		}
		SnsMessages.Message message;
		try {
			message = sns.read(payload, reporting.sesRegion());
		}
		catch (IllegalArgumentException | JacksonException invalid) {
			throw refused("An SNS message did not verify");
		}
		if (!reporting.sesEventsTopicArn().equals(message.topicArn())) {
			throw refused("An SNS message came from another topic");
		}
		if ("SubscriptionConfirmation".equals(message.type()) && message.subscribeUrl() != null) {
			confirm(message.subscribeUrl());
			return;
		}
		if (!"Notification".equals(message.type())) {
			return;
		}
		JsonNode event = json.readTree(message.message());
		String kind = event.path("eventType").asString(event.path("notificationType").asString(""));
		String messageId = event.path("mail").path("messageId").asString("");
		DeliveryReport.Type type = switch (kind) {
			case "Delivery" -> DeliveryReport.Type.DELIVERED;
			case "Bounce" -> "Permanent".equals(event.path("bounce").path("bounceType").asString(""))
					? DeliveryReport.Type.BOUNCED : DeliveryReport.Type.SOFT_BOUNCED;
			case "Complaint" -> DeliveryReport.Type.COMPLAINED;
			default -> null;
		};
		if (type == null || messageId.isEmpty()) {
			return;
		}
		JsonNode at = switch (type) {
			case DELIVERED -> event.path("delivery").path("timestamp");
			case BOUNCED, SOFT_BOUNCED -> event.path("bounce").path("timestamp");
			case COMPLAINED -> event.path("complaint").path("timestamp");
		};
		reports.apply(new DeliveryReport(EmailProvider.SES, messageId, type, instant(at),
				detail(event.path("bounce").path("bounceSubType")), message.messageId()));
	}

	/** Answers SNS's request to confirm the subscription; the message's signature and address have been checked. */
	private void confirm(URI subscribeUrl) {
		try {
			HttpResponse<Void> answer = http.send(HttpRequest.newBuilder(subscribeUrl)
				.timeout(Duration.ofSeconds(20))
				.GET()
				.build(), HttpResponse.BodyHandlers.discarding());
			LOG.atInfo()
				.addKeyValue("event", "notification.email.sns_subscription_confirmed")
				.addKeyValue("status", answer.statusCode())
				.log("Confirmed the SNS subscription of SES reports");
		}
		catch (IOException failure) {
			throw new NotificationException(NotificationErrorCode.SUBSCRIPTION_NOT_CONFIRMED,
					"The SNS subscription could not be confirmed");
		}
		catch (InterruptedException interrupted) {
			Thread.currentThread().interrupt();
			throw new NotificationException(NotificationErrorCode.SUBSCRIPTION_NOT_CONFIRMED,
					"The SNS subscription confirmation was interrupted");
		}
	}

	private static Instant instant(JsonNode value) {
		try {
			return Instant.parse(value.asString(""));
		}
		catch (RuntimeException unreadable) {
			return Instant.now();
		}
	}

	/** A provider's code such as {@code General} or {@code OnAccountSuppressionList}; never free text. */
	private static @Nullable String detail(JsonNode value) {
		String code = value.asString("");
		return code.matches("[A-Za-z]{1,40}") ? code : null;
	}

	private static NotificationException refused(String diagnostic) {
		return new NotificationException(NotificationErrorCode.EVENT_REFUSED, diagnostic);
	}

}
