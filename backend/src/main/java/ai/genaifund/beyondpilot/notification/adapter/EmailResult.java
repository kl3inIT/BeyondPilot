package ai.genaifund.beyondpilot.notification.adapter;

import java.util.Objects;

/**
 * What a provider answered for an email it took.
 * @param providerMessageId the provider's identifier of the message, which its delivery reports name
 */
public record EmailResult(String providerMessageId) {

	public EmailResult {
		Objects.requireNonNull(providerMessageId, "providerMessageId must not be null");
	}

}
