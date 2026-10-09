package ai.genaifund.beyondpilot.ai.adapter;

import java.time.Duration;

/** Reads the text of a picture through the OCR services that speak one API. */
public interface OcrAdapter {

	/** The stable name a provider is stored with, such as {@code aihay}. */
	String type();

	/** The largest picture the service takes, in bytes. */
	int maxPictureBytes();

	/**
	 * The text of one picture, as the service returns it; empty when it finds none.
	 * @param picture a JPEG no larger than {@link #maxPictureBytes()}
	 * @throws OcrProviderException when the key is refused, the service cannot be reached, its answer is not this
	 * API's, or it will not read this picture
	 */
	String read(OcrConnection connection, byte[] picture, Duration timeout);

}
