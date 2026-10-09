package ai.genaifund.beyondpilot.ai.adapter;

/**
 * An OCR service did not read a picture. It names the kind of failure and nothing the service said, since a service's
 * text can repeat the request or carry account detail.
 */
public final class OcrProviderException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final Failure failure;

	public OcrProviderException(Failure failure) {
		super("The OCR service answered " + failure);
		this.failure = failure;
	}

	public Failure failure() {
		return failure;
	}

	public enum Failure {

		/** The service refused the key, or the key may not use OCR. */
		CREDENTIAL_REJECTED,

		/** No answer: refused connection, timeout, a server error, or a limit on calls. */
		UNREACHABLE,

		/** An answer that is not this API's: another status, a redirect, or not the JSON expected. */
		INCOMPATIBLE,

		/** The service will not read this picture: too large, or not an image it takes. Another picture may be read. */
		PICTURE_REFUSED

	}

}
