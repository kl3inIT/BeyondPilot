package ai.genaifund.beyondpilot.notification.delivery;

import java.time.Instant;
import java.util.Objects;

import ai.genaifund.beyondpilot.notification.adapter.EmailProvider;
import org.jspecify.annotations.Nullable;

/**
 * What a provider reported about one message it took, after its signature was checked.
 * @param providerMessageId the provider's identifier of the message, as it answered when it took it
 * @param detail a typed summary, such as the kind of bounce; never the provider's free text
 * @param sourceId the provider's identifier of the report, so that a report delivered twice counts once
 */
public record DeliveryReport(EmailProvider provider, String providerMessageId, Type type, Instant occurredAt,
		@Nullable String detail, @Nullable String sourceId) {

	public DeliveryReport {
		Objects.requireNonNull(provider, "provider must not be null");
		Objects.requireNonNull(providerMessageId, "providerMessageId must not be null");
		Objects.requireNonNull(type, "type must not be null");
		Objects.requireNonNull(occurredAt, "occurredAt must not be null");
	}

	/** What happened to the message. */
	public enum Type {

		DELIVERED("delivered"),

		/** The address does not exist or refuses mail for good: it is suppressed. */
		BOUNCED("bounced"),

		/** The mailbox is full or the server is busy: recorded, nothing is suppressed. */
		SOFT_BOUNCED("soft_bounced"),

		/** The recipient marked it as spam: the address is suppressed. */
		COMPLAINED("complained");

		private final String value;

		Type(String value) {
			this.value = value;
		}

		public String value() {
			return value;
		}

	}

}
