package ai.genaifund.beyondpilot.ai.adapter;

import org.jspecify.annotations.Nullable;

/**
 * An OCR service did not read a picture. It names the kind of failure and nothing the service said, since a service's
 * text can repeat the request or carry account detail.
 */
public final class OcrProviderException extends RuntimeException {

	private static final long serialVersionUID = 1L;

	private final Failure failure;

	private final @Nullable Integer status;

	/** A failure with no status to keep: no answer at all, or a 200 that is not this API's. */
	public OcrProviderException(Failure failure) {
		this(failure, null);
	}

	/** @param status the HTTP status the service answered with */
	public OcrProviderException(Failure failure, @Nullable Integer status) {
		super("The OCR service answered " + failure);
		this.failure = failure;
		this.status = status;
	}

	public Failure failure() {
		return failure;
	}

	/** The HTTP status the service answered with; null when it did not answer, or answered 200 with something else. */
	public @Nullable Integer status() {
		return status;
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
