package ai.genaifund.beyondpilot.identity;

import ai.genaifund.beyondpilot.TestMailbox;
import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;

/** Signs a person in over HTTP, the way a browser does, for tests of other modules that need a session. */
public final class TestSignIn {

	public static final String SESSION_COOKIE = "BEYONDPILOT_SESSION";

	public static final String CSRF_HEADER = "X-BeyondPilot-CSRF";

	private TestSignIn() {
	}

	/**
	 * The session of the address after it asked for a code, typed it and accepted every consent purpose, as a person
	 * does before using the platform.
	 */
	public static String session(RestTestClient client, TestMailbox mail, String email) {
		String session = sessionWithoutConsent(client, mail, email);
		client.put()
			.uri("/api/identity/consent")
			.cookie(SESSION_COOKIE, session)
			.header(CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_JSON)
			.body(Map.of("platform", true, "partners", true, "ai", true, "updates", true, "source", "accept_all"))
			.exchange()
			.expectStatus()
			.isOk();
		return session;
	}

	/** The session of the address after it asked for a code and typed it, before it answered the consent. */
	public static String sessionWithoutConsent(RestTestClient client, TestMailbox mail, String email) {
		String browser = sessionOf(client.post()
			.uri("/ott/generate")
			.header(CSRF_HEADER, "1")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("username=" + email)
			.exchange()
			.expectStatus()
			.isNoContent());
		return sessionOf(client.post()
			.uri("/login/ott")
			.header(CSRF_HEADER, "1")
			.cookie(SESSION_COOKIE, browser)
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("code=" + mail.latestCodeTo(email))
			.exchange()
			.expectStatus()
			.isNoContent());
	}

	private static String sessionOf(RestTestClient.ResponseSpec response) {
		List<String> cookies = response.expectBody()
			.returnResult()
			.getResponseHeaders()
			.getOrEmpty(HttpHeaders.SET_COOKIE);
		String cookie = cookies.stream()
			.filter(value -> value.startsWith(SESSION_COOKIE + "="))
			.findFirst()
			.orElseThrow(() -> new AssertionError("No session cookie in " + cookies));
		return cookie.substring(SESSION_COOKIE.length() + 1, cookie.indexOf(';'));
	}
}
