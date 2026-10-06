package ai.genaifund.beyondpilot.notification.adapter;

import java.time.Duration;

import ai.genaifund.beyondpilot.notification.NotificationProperties;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.core.net.RequestOptions;
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
