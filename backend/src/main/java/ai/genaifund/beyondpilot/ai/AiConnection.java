package ai.genaifund.beyondpilot.ai;

import java.util.UUID;

/**
 * Where a provider is reached, with its key in clear: what a client is built from. It is made for one call or one
 * client and never stored or logged.
 */
public record AiConnection(UUID providerId, String adapterType, String name, String baseUrl, String apiKey) {

	@Override
	public String toString() {
		return "AiConnection[" + providerId + ", redacted]";
	}

}
