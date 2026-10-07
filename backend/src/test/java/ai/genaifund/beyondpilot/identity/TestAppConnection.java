package ai.genaifund.beyondpilot.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

import com.jayway.jsonpath.JsonPath;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Connects an AI app the way one does, for tests of other modules that call the MCP servers: the shared client of
 * agents on a person's computer, the authorization request, the person's consent and the code exchanged for tokens.
 */
public final class TestAppConnection {

	/** The client every test app connects as. */
	public static final String CLIENT = "mcp-local";

	private static final String REDIRECT = "http://127.0.0.1:61234/cb";

	private static final String VERIFIER = "a-verifier-of-enough-length-for-pkce-0123456789abcdefghijklmnop";

	private TestAppConnection() {
	}

	/** The tokens an app gets once the person behind {@code session} allows {@code scope}. */
	public static Tokens connect(RestTestClient client, int port, String session, String scope) {
		URI consentPage = client.get()
			.uri(UriComponentsBuilder.fromUriString("http://localhost:" + port + "/oauth2/authorize")
				.queryParam("response_type", "code")
				.queryParam("client_id", CLIENT)
				.queryParam("scope", scope)
				.queryParam("redirect_uri", REDIRECT)
				.queryParam("code_challenge", challenge())
				.queryParam("code_challenge_method", "S256")
				.queryParam("state", "test")
				.encode()
				.build()
				.toUri())
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();
		assertThat(consentPage.toString()).contains("/oauth-consent?");
		String state = URLDecoder.decode(
				UriComponentsBuilder.fromUri(consentPage).build().getQueryParams().getFirst("state"),
				StandardCharsets.UTF_8);
		StringBuilder form = new StringBuilder(
				"client_id=" + CLIENT + "&state=" + URLEncoder.encode(state, StandardCharsets.UTF_8));
		for (String granted : scope.split(" ")) {
			form.append("&scope=").append(granted);
		}
		URI back = client.post()
			.uri("/oauth2/authorize")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body(form.toString())
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();
		String code = UriComponentsBuilder.fromUri(back).build().getQueryParams().getFirst("code");
		String tokens = client.post()
			.uri("/oauth2/token")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("grant_type=authorization_code&client_id=" + CLIENT + "&code=" + code + "&redirect_uri=" + REDIRECT
					+ "&code_verifier=" + VERIFIER)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody(String.class)
			.returnResult()
			.getResponseBody();
		return new Tokens(JsonPath.read(tokens, "$.access_token"), JsonPath.read(tokens, "$.refresh_token"));
	}

	private static String challenge() {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256").digest(VERIFIER.getBytes(StandardCharsets.US_ASCII));
			return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
		}
		catch (NoSuchAlgorithmException impossible) {
			throw new IllegalStateException(impossible);
		}
	}

	public record Tokens(String access, String refresh) {
	}

}
