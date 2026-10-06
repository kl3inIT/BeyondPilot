package ai.genaifund.beyondpilot.notification.adapter;

import java.util.Objects;
import java.util.UUID;

import org.jspecify.annotations.Nullable;

/**
 * One email to hand to a provider.
 * @param messageId BeyondPilot's identifier of the message; a provider that takes an idempotency key is given it, so a
 * send that is retried after a lost answer is not delivered twice
 * @param replyTo where answers go; null to the sender
 * @param kind what the email is for, given to providers that tag messages
 */
public record EmailRequest(UUID messageId, String fromName, String fromAddress, @Nullable String replyTo, String to,
		String subject, String html, String text, String kind) {

	public EmailRequest {
		Objects.requireNonNull(messageId, "messageId must not be null");
		Objects.requireNonNull(fromName, "fromName must not be null");
		Objects.requireNonNull(fromAddress, "fromAddress must not be null");
		Objects.requireNonNull(to, "to must not be null");
		Objects.requireNonNull(subject, "subject must not be null");
		Objects.requireNonNull(html, "html must not be null");
		Objects.requireNonNull(text, "text must not be null");
		Objects.requireNonNull(kind, "kind must not be null");
	}

	@Override
	public String toString() {
		return "EmailRequest[messageId=" + messageId + ", kind=" + kind + "]";
	}

}
