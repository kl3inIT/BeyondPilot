package ai.genaifund.beyondpilot.identity.oauth;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;

import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;

/**
 * Resolves a host only to addresses on the public internet, so a document an outsider names cannot make the server
 * reach this machine, its network or a cloud metadata service. The connection is made to the addresses checked here,
 * so a name that resolves elsewhere a moment later (DNS rebinding) changes nothing. A host with any address that is not
 * public is refused whole: IANA's special-purpose IPv4 and IPv6 registries, and IPv6 forms that carry an IPv4 address.
 */
final class PublicAddresses implements DnsResolver {

	private final DnsResolver system = SystemDefaultDnsResolver.INSTANCE;

	@Override
	public InetAddress[] resolve(String host) throws UnknownHostException {
		InetAddress[] addresses = system.resolve(host);
		for (InetAddress address : addresses) {
			if (!isPublic(address)) {
				throw new UnknownHostException("Not a public address: " + host);
			}
		}
		return addresses;
	}

	@Override
	public String resolveCanonicalHostname(String host) throws UnknownHostException {
		return system.resolveCanonicalHostname(host);
	}

	static boolean isPublic(InetAddress address) {
		if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
				|| address.isSiteLocalAddress() || address.isMulticastAddress()) {
			return false;
		}
		byte[] b = address.getAddress();
		return switch (address) {
			case Inet4Address v4 -> isPublicV4(b);
			case Inet6Address v6 -> isPublicV6(b);
			default -> false;
		};
	}

	private static boolean isPublicV4(byte[] b) {
		int a0 = b[0] & 0xff;
		int a1 = b[1] & 0xff;
		int a2 = b[2] & 0xff;
		return !(a0 == 0 || a0 == 10 || a0 == 127 || a0 >= 224
				|| (a0 == 100 && a1 >= 64 && a1 <= 127)
				|| (a0 == 169 && a1 == 254)
				|| (a0 == 172 && a1 >= 16 && a1 <= 31)
				|| (a0 == 192 && a1 == 0 && (a2 == 0 || a2 == 2))
				|| (a0 == 192 && a1 == 88 && a2 == 99)
				|| (a0 == 192 && a1 == 168)
				|| (a0 == 198 && (a1 == 18 || a1 == 19))
				|| (a0 == 198 && a1 == 51 && a2 == 100)
				|| (a0 == 203 && a1 == 0 && a2 == 113));
	}

	private static boolean isPublicV6(byte[] b) {
		int first = b[0] & 0xff;
		int second = b[1] & 0xff;
		if ((first & 0xfe) == 0xfc || first == 0xff || (first == 0xfe && (second & 0xc0) == 0x80)) {
			// Unique local fc00::/7, multicast ff00::/8, link-local fe80::/10.
			return false;
		}
		if (first == 0x20 && second == 0x01 && (b[2] & 0xff) == 0x0d && (b[3] & 0xff) == 0xb8) {
			return false; // Documentation 2001:db8::/32.
		}
		if (first == 0x20 && second == 0x01 && (b[2] & 0xfe) == 0x00) {
			return false; // IETF protocol assignments 2001::/23, Teredo among them.
		}
		if (first == 0x20 && second == 0x02) {
			return false; // 6to4 2002::/16 carries an IPv4 address.
		}
		if (first == 0x00 && second == 0x64 && (b[2] & 0xff) == 0xff && (b[3] & 0xff) == 0x9b) {
			return false; // NAT64 64:ff9b::/96 and 64:ff9b:1::/48 carry an IPv4 address.
		}
		boolean leadingZeros = true;
		for (int i = 0; i < 10; i++) {
			leadingZeros &= b[i] == 0;
		}
		// The unspecified and loopback addresses, and IPv4-compatible or IPv4-mapped ones (::/96, ::ffff:0:0/96).
		return !leadingZeros;
	}

}
