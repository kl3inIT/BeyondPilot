package ai.genaifund.beyondpilot.notification.adapter;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.core.net.RequestOptions;
import com.resend.services.domains.dto.DomainDTO;
import com.resend.services.domains.model.Domain;
import com.resend.services.domains.model.Record;
import com.resend.services.emails.model.CreateEmailOptions;
import com.resend.services.emails.model.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Delivers through Resend's API with its Java SDK. The message's identifier is the idempotency key, so a send retried
 * after a lost answer is delivered once.
 */
@Component
class ResendEmailAdapter implements EmailAdapter {

	private record Client(EmailConnection.ResendConnection connection, Resend resend) {
	}

	private final String apiUrl;

	private volatile @Nullable Client client;

	ResendEmailAdapter(NotificationProperties properties) {
		this.apiUrl = properties.resend().apiUrl();
	}

	@Override
	public EmailProvider provider() {
		return EmailProvider.RESEND;
	}

	@Override
	public EmailProviderCapabilities capabilities() {
		return new EmailProviderCapabilities(true);
	}

	@Override
	public EmailResult send(EmailRequest request, EmailConnection connection) {
		CreateEmailOptions.Builder email = CreateEmailOptions.builder()
			.from(request.fromName().replace("\"", "") + " <" + request.fromAddress() + ">")
			.to(request.to())
			.subject(request.subject())
			.html(request.html())
			.text(request.text())
			.tags(Tag.builder().name("kind").value(request.kind()).build());
		if (request.replyTo() != null) {
			email.replyTo(request.replyTo());
		}
		try {
			String id = resend((EmailConnection.ResendConnection) connection).emails()
				.send(email.build(),
						RequestOptions.builder().setIdempotencyKey(request.messageId().toString()).build())
				.getId();
			return new EmailResult(id);
		}
		catch (ResendException exception) {
			Integer status = exception.getStatusCode();
			EmailDeliveryException.DeliveryFailure failure;
			if (status == null || status >= 500) {
				failure = EmailDeliveryException.DeliveryFailure.UNAVAILABLE;
			}
			else if (status == 429) {
				failure = EmailDeliveryException.DeliveryFailure.THROTTLED;
			}
			else if (status == 401 || status == 403) {
				failure = EmailDeliveryException.DeliveryFailure.AUTHENTICATION;
			}
			else {
				failure = EmailDeliveryException.DeliveryFailure.REJECTED;
			}
			throw new EmailDeliveryException(failure, "Resend answered " + status, exception);
		}
	}

	/**
	 * Reads the sender's domain at Resend: whether it is added and verified, and each DNS record with what Resend found.
	 * A sending-only key cannot read domains, which says so instead of failing the checks.
	 */
	@Override
	public EmailSetup inspect(EmailConnection connection, String domain) {
		Resend resend = resend((EmailConnection.ResendConnection) connection);
		List<EmailSetup.Check> checks = new ArrayList<>();
		List<EmailSetup.DnsRecord> records = new ArrayList<>();
		try {
			DomainDTO added = resend.domains()
				.list()
				.getData()
				.stream()
				.filter(candidate -> domain.equalsIgnoreCase(candidate.getName()))
				.findFirst()
				.orElse(null);
			checks.add(new EmailSetup.Check(EmailSetup.Step.CREDENTIALS, EmailSetup.State.OK));
			if (added == null) {
				checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.FAILED));
				return new EmailSetup(checks, records, null);
			}
			checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_ADDED, EmailSetup.State.OK));
			Domain read = resend.domains().get(added.getId());
			checks.add(new EmailSetup.Check(EmailSetup.Step.DOMAIN_VERIFIED, state(read.getStatus())));
			EmailSetup.State dkim = EmailSetup.State.UNKNOWN;
			for (Record record : read.getRecords() == null ? List.<Record>of() : read.getRecords()) {
				String purpose = String.valueOf(record.getRecord()).toLowerCase(Locale.ROOT).replace(' ', '_');
				EmailSetup.State found = state(record.getStatus());
				if ("dkim".equals(purpose)) {
					dkim = found;
				}
				records.add(new EmailSetup.DnsRecord(purpose, record.getType(),
						EmailSetup.DnsRecord.hostOf(record.getName(), domain), record.getValue(),
						"MX".equalsIgnoreCase(record.getType()) ? Integer.valueOf(record.getPriority()) : null, found));
			}
			checks.add(new EmailSetup.Check(EmailSetup.Step.DKIM, dkim));
			return new EmailSetup(checks, records, null);
		}
		catch (ResendException refused) {
			Integer status = refused.getStatusCode();
			EmailSetup.Limit limit = status == null || status >= 500 ? EmailSetup.Limit.UNREACHABLE
					: "restricted_api_key".equals(refused.getErrorName()) ? EmailSetup.Limit.PERMISSION_MISSING
							: EmailSetup.Limit.CREDENTIALS_REFUSED;
			return new EmailSetup(checks, records, limit);
		}
	}

	/** Resend's words for where a domain or a record stands. */
	private static EmailSetup.State state(@Nullable String status) {
		return switch (status == null ? "" : status) {
			case "verified" -> EmailSetup.State.OK;
			case "pending", "not_started" -> EmailSetup.State.PENDING;
			case "failed", "temporary_failure", "failure" -> EmailSetup.State.FAILED;
			default -> EmailSetup.State.UNKNOWN;
		};
	}

	private Resend resend(EmailConnection.ResendConnection connection) {
		Client current = client;
		if (current != null && current.connection().equals(connection)) {
			return current.resend();
		}
		Resend resend = Resend.builder()
			.apiKey(connection.apiKey())
			.baseUrl(apiUrl)
			.connectTimeout(Duration.ofSeconds(10))
			.readTimeout(Duration.ofSeconds(20))
			.build();
		client = new Client(connection, resend);
		return resend;
	}

}
