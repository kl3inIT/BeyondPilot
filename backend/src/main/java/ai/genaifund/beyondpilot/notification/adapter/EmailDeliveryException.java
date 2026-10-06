package ai.genaifund.beyondpilot.notification.adapter;

/**
 * A provider did not take an email. The reason is typed so that the queue decides from it alone whether to try again,
 * and the log records it without a provider's text, which may echo addresses or secrets.
 */
public class EmailDeliveryException extends RuntimeException {

	private final DeliveryFailure failure;

	public EmailDeliveryException(DeliveryFailure failure, String diagnosticMessage, Throwable cause) {
		super(diagnosticMessage, cause);
		this.failure = failure;
	}

	public EmailDeliveryException(DeliveryFailure failure, String diagnosticMessage) {
		super(diagnosticMessage);
		this.failure = failure;
	}

	public DeliveryFailure failure() {
		return failure;
	}

	/** Why an email was not sent. */
	public enum DeliveryFailure {

		/** No provider is configured, or its settings are incomplete or cannot be read. */
		NOT_CONFIGURED("not_configured", true),

		/** The provider refused the credentials. Retried, because an operator may correct them. */
		AUTHENTICATION("authentication", true),

		/** The provider asked to slow down. */
		THROTTLED("throttled", true),

		/** The provider could not be reached or failed on its side. */
		UNAVAILABLE("unavailable", true),

		/** The provider refused this message for good: the sender is not verified, or the content was rejected. */
		REJECTED("rejected", false),

		/** The provider refused the recipient's address for good. */
		INVALID_RECIPIENT("invalid_recipient", false),

		/** The address is suppressed, so the email was never handed over. */
		SUPPRESSED("suppressed", false),

		/** The email waited longer than BeyondPilot keeps trying. */
		EXPIRED("expired", false);

		private final String value;

		private final boolean temporary;

		DeliveryFailure(String value, boolean temporary) {
			this.value = value;
			this.temporary = temporary;
		}

		public String value() {
			return value;
		}

		public boolean temporary() {
			return temporary;
		}

	}

}
