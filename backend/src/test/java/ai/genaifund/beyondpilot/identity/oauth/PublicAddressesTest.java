package ai.genaifund.beyondpilot.identity.oauth;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import java.net.UnknownHostException;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

/** Which addresses a document fetch may connect to: the public internet only. */
class PublicAddressesTest {

	@ParameterizedTest
	@ValueSource(strings = { "0.0.0.0", "10.1.2.3", "100.64.0.1", "127.0.0.1", "169.254.169.254", "172.16.0.1",
			"172.31.255.255", "192.0.0.8", "192.0.2.1", "192.88.99.1", "192.168.1.1", "198.18.0.1", "198.51.100.1",
			"203.0.113.1", "224.0.0.1", "240.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1",
			"::ffff:169.254.169.254", "::127.0.0.1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "2001:db8::1",
			"2001::1", "2002:7f00:1::", "64:ff9b::7f00:1" })
	void anAddressOutsideThePublicInternetIsRefused(String address) throws UnknownHostException {
		assertThat(PublicAddresses.isPublic(InetAddress.getByName(address))).isFalse();
	}

	@ParameterizedTest
	@ValueSource(strings = { "1.1.1.1", "8.8.8.8", "104.18.0.1", "172.32.0.1", "100.128.0.1", "2606:4700:4700::1111",
			"2a00:1450:4001::1" })
	void aPublicAddressIsAllowed(String address) throws UnknownHostException {
		assertThat(PublicAddresses.isPublic(InetAddress.getByName(address))).isTrue();
	}

}
