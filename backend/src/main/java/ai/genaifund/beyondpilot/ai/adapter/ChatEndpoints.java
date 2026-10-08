package ai.genaifund.beyondpilot.ai.adapter;

import java.net.URI;

/**
 * What a chat provider's address may be, as MemoryOS accepts it: {@code http} or {@code https}, private hosts
 * included, since a self-hosted gateway often sits on one. Operators are trusted to name an endpoint; an address never
 * carries credentials, a query or a fragment, where a secret could hide.
 */
public final class ChatEndpoints {

	private static final int MAX_LENGTH = 2048;

	private ChatEndpoints() {
	}

	public static boolean valid(String url) {
		if (url.isBlank() || url.length() > MAX_LENGTH || !url.equals(url.strip())) {
			return false;
		}
		try {
			URI endpoint = URI.create(url);
			boolean web = "https".equalsIgnoreCase(endpoint.getScheme()) || "http".equalsIgnoreCase(endpoint.getScheme());
			return web && endpoint.getHost() != null && endpoint.getRawUserInfo() == null
					&& endpoint.getRawQuery() == null && endpoint.getRawFragment() == null;
		}
		catch (IllegalArgumentException malformed) {
			return false;
		}
	}

	/** The address without a trailing slash, so a path is appended the same way whatever the operator typed. */
	static String base(String url) {
		return url.replaceAll("/+$", "");
	}

}
