package ai.genaifund.beyondpilot.ai.adapter;

/** Where a chat provider is reached and the key to send it. Made for one call or one client; never logged. */
public record ChatConnection(String baseUrl, String apiKey) {

	@Override
	public String toString() {
		return "ChatConnection[redacted]";
	}

}
