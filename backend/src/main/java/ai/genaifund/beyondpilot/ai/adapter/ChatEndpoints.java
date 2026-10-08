package ai.genaifund.beyondpilot.ai.adapter;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;

/**
 * What a chat provider's address may be, as MemoryOS accepts it: {@code http} or {@code https}, private hosts
 * included, since a self-hosted gateway often sits on one. Operators are trusted to name an endpoint; an address never
 * carries credentials, a query or a fragment, where a secret could hide. A link-local address is refused: no gateway
 * sits there, and a cloud host answers its own credentials on one.
 */
public final class ChatEndpoints {

	private static final int MAX_LENGTH = 2048;

	/** The metadata service of an AWS host over IPv6, which is not in the link-local range. */
	private static final String AWS_METADATA_V6 = "fd00:ec2::254";

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
					&& endpoint.getRawQuery() == null && endpoint.getRawFragment() == null
					&& !linkLocal(endpoint.getHost());
		}
		catch (IllegalArgumentException malformed) {
			return false;
		}
	}

	/** Whether a host written as an address is link-local, where cloud hosts keep their metadata service. */
	private static boolean linkLocal(String host) {
		boolean literal = host.startsWith("[") || host.matches("[0-9.]+");
		if (!literal) {
			return false;
		}
		try {
			// A literal is parsed, never looked up.
			InetAddress address = InetAddress.getByName(host);
			return address.isLinkLocalAddress() || address.equals(InetAddress.getByName(AWS_METADATA_V6));
		}
		catch (UnknownHostException malformed) {
			return true;
		}
	}

	/** The address without a trailing slash, so a path is appended the same way whatever the operator typed. */
	static String base(String url) {
		return url.replaceAll("/+$", "");
	}

}
