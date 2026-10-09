package ai.genaifund.beyondpilot.ai.adapter;

/** Where an OCR service is reached and the key to send it. Made for one call; never logged. */
public record OcrConnection(String baseUrl, String apiKey) {

	@Override
	public String toString() {
		return "OcrConnection[redacted]";
	}

}
