package ai.genaifund.beyondpilot.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.client.EntityExchangeResult;
import org.springframework.test.web.servlet.client.RestTestClient;

/**
 * The start of the Google round trip, which exists only where a client is configured. The return from Google needs
 * Google itself, so it is exercised on a deployed environment (docs/tests/identity.md).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.google.client-id=test-client",
				"beyondpilot.identity.google.client-secret=test-secret" })
@Import(TestcontainersConfiguration.class)
class GoogleSignInStartTest {

	private static final String SESSION_COOKIE = "BEYONDPILOT_SESSION=";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient jdbc;

	private RestTestClient client;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
	}

	@Test
	void choosingGoogleRedirectsToGoogleAndRemembersWhereThePersonWas() {
		EntityExchangeResult<byte[]> result = start("/programs/insurance");

		URI location = result.getResponseHeaders().getLocation();
		assertThat(location).isNotNull();
		assertThat(location.getHost()).isEqualTo("accounts.google.com");
		assertThat(location.getQuery()).contains("client_id=test-client")
			.contains("scope=openid email profile")
			.contains("redirect_uri=http://localhost:" + port + "/login/oauth2/code/google");
		assertThat(rememberedDestinations(result)).isEqualTo(1);
	}

	@Test
	void aDestinationOnAnotherSiteIsNotRemembered() {
		assertThat(rememberedDestinations(start("https://evil.example"))).isZero();
	}

	private EntityExchangeResult<byte[]> start(String returnTo) {
		return client.get()
			.uri("/oauth2/authorization/google?returnTo={returnTo}", returnTo)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.expectBody()
			.returnResult();
	}

	/** How many return destinations the stored session of this response holds. */
	private int rememberedDestinations(EntityExchangeResult<byte[]> result) {
		String cookie = result.getResponseHeaders()
			.getOrEmpty(HttpHeaders.SET_COOKIE)
			.stream()
			.filter(value -> value.startsWith(SESSION_COOKIE))
			.findFirst()
			.orElseThrow(() -> new AssertionError("The round trip keeps its state in a session"));
		String value = cookie.substring(SESSION_COOKIE.length(), cookie.indexOf(';'));
		String sessionId = new String(Base64.getDecoder().decode(value), StandardCharsets.UTF_8);
		return jdbc.sql("""
				select count(*) from spring_session_attributes attribute
				join spring_session session on session.primary_id = attribute.session_primary_id
				where session.session_id = ? and attribute.attribute_name like '%ReturnToFilter.returnTo'
				""").param(sessionId).query(Integer.class).single();
	}
}
