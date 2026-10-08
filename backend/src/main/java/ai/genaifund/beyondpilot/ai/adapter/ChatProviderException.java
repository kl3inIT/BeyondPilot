package ai.genaifund.beyondpilot.ai.adapter;

/**
 * A chat provider did not answer a request as expected. It names the kind of failure and nothing the provider said,
 * since a provider's text can repeat the request or carry account detail.
 */
public final class ChatProviderException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final Failure failure;

	public ChatProviderException(Failure failure) {
		super("The chat provider answered " + failure);
		this.failure = failure;
	}

	public Failure failure() {
		return failure;
	}

	public enum Failure {

		/** The provider refused the key. */
		CREDENTIAL_REJECTED,

		/** No answer: refused connection, timeout, or a server error. */
		UNREACHABLE,

		/** An answer that is not this API's: another status, a redirect, or not the JSON expected. */
		INCOMPATIBLE

	}

}
