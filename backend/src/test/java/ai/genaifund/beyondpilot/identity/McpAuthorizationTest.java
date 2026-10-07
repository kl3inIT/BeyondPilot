package ai.genaifund.beyondpilot.identity;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Map;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import ai.genaifund.beyondpilot.TestMailbox;
import ai.genaifund.beyondpilot.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.core.AuthorizationGrantType;
import org.springframework.security.oauth2.core.ClientAuthenticationMethod;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClient;
import org.springframework.security.oauth2.server.authorization.client.RegisteredClientRepository;
import org.springframework.security.oauth2.server.authorization.settings.ClientSettings;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * An AI app signing in through the authorization server over real HTTP: Cursor's registered client, a person who
 * signs in and consents, the code with the issuer, the tokens and their audience, and refresh that replaces the token.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
		properties = { "beyondpilot.identity.operator-emails=Operator@genaifund.test",
				"beyondpilot.identity.oauth.issuer=http://localhost:3000" })
@Import({ TestcontainersConfiguration.class, IdentitySignInTest.Mail.class })
class McpAuthorizationTest {

	private static final String ISSUER = "http://localhost:3000";

	/** Cursor redirects to a port it picks; the client lists 8787. */
	private static final String REDIRECT = "http://localhost:53111/callback";

	private static final String VERIFIER = "a-verifier-of-enough-length-for-pkce-0123456789abcdefghijklmnop";

	@LocalServerPort
	private int port;

	@Autowired
	private TestMailbox mail;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private RegisteredClientRepository clients;

	private RestTestClient client;

	@BeforeEach
	void setUp() {
		client = RestTestClient.bindToServer(new JdkClientHttpRequestFactory()).baseUrl("http://localhost:" + port).build();
	}

	@Test
	void aBrowserNotSignedInIsSentToTheSignInPageAndBackToTheRequest() {
		URI location = client.get()
			.uri(authorize("mcp.read"))
			.header(HttpHeaders.ACCEPT, MediaType.TEXT_HTML_VALUE)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();

		assertThat(location.getPath()).isEqualTo("/sign-in");
		String back = UriComponentsBuilder.fromUri(location).build(true).getQueryParams().getFirst("returnTo");
		assertThat(java.net.URLDecoder.decode(back, StandardCharsets.UTF_8)).startsWith("/oauth2/authorize?");
	}

	@Test
	void aPersonWhoConsentsGivesTheAppTokensForThePublicServerThatRefreshOnce() {
		String session = TestSignIn.session(client, mail, "linh.mcp@example.test");

		Map<String, String> answer = consent(session, "mcp.read", "mcp.read");
		assertThat(answer.get("iss")).isEqualTo(ISSUER);
		assertThat(answer.get("state")).isEqualTo("state-1");

		String tokens = token("grant_type=authorization_code&client_id=cursor&code=" + answer.get("code")
				+ "&redirect_uri=" + REDIRECT + "&code_verifier=" + VERIFIER);
		assertThat(audienceOf(JsonPath.read(tokens, "$.access_token"))).isEqualTo(ISSUER + "/mcp");
		assertThat((Integer) JsonPath.read(tokens, "$.expires_in")).isBetween(3590, 3600);
		String refresh = JsonPath.read(tokens, "$.refresh_token");

		String refreshed = token("grant_type=refresh_token&client_id=cursor&refresh_token=" + refresh);
		assertThat((String) JsonPath.read(refreshed, "$.refresh_token")).isNotEqualTo(refresh);
		assertThat(audienceOf(JsonPath.read(refreshed, "$.access_token"))).isEqualTo(ISSUER + "/mcp");

		client.post()
			.uri("/oauth2/token")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("grant_type=refresh_token&client_id=cursor&refresh_token=" + refresh)
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.error")
			.isEqualTo("invalid_grant");
	}

	@Test
	void aDisabledAccountCannotConnectAnAppAndItsConnectionsStopRefreshing() {
		String session = TestSignIn.session(client, mail, "khoa.mcp@example.test");
		Map<String, String> answer = consent(session, "mcp.read", "mcp.read");
		String tokens = token("grant_type=authorization_code&client_id=cursor&code=" + answer.get("code")
				+ "&redirect_uri=" + REDIRECT + "&code_verifier=" + VERIFIER);

		jdbc.sql("update identity_account set status = 'disabled' where email = 'khoa.mcp@example.test'").update();

		URI location = client.get()
			.uri(authorize("mcp.read"))
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.header(HttpHeaders.ACCEPT, MediaType.TEXT_HTML_VALUE)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();
		assertThat(location.getPath()).isEqualTo("/sign-in");

		client.post()
			.uri("/oauth2/token")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("grant_type=refresh_token&client_id=cursor&refresh_token="
					+ JsonPath.read(tokens, "$.refresh_token"))
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.error")
			.isEqualTo("invalid_grant");
	}

	@Test
	void theOperatorsScopeIsLeftOutOfTheConsentOfAnyoneElse() {
		String session = TestSignIn.session(client, mail, "quan.mcp@example.test");

		Map<String, String> answer = consent(session, "mcp.read mcp.research", "mcp.read mcp.research");
		String tokens = token("grant_type=authorization_code&client_id=cursor&code=" + answer.get("code")
				+ "&redirect_uri=" + REDIRECT + "&code_verifier=" + VERIFIER);

		assertThat((String) JsonPath.read(tokens, "$.scope")).isEqualTo("mcp.read");
		assertThat(audienceOf(JsonPath.read(tokens, "$.access_token"))).isEqualTo(ISSUER + "/mcp");
	}

	@Test
	void aRequestForTheOperatorServerWithoutItsScopeIsRefused() {
		String session = TestSignIn.session(client, mail, "tam.mcp@example.test");

		URI back = client.get()
			.uri(authorize("mcp.read", ISSUER + "/mcp/operator"))
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();

		assertThat(back.toString()).startsWith(REDIRECT + "?error=invalid_request");
	}

	@Test
	void anOperatorWhoLosesTheRoleStopsGettingTokensForTheOperatorServer() {
		String email = "lan.operator@genaifund.test";
		String session = TestSignIn.session(client, mail, email);
		jdbc.sql("update identity_account set platform_role = 'operator' where email = :email")
			.param("email", email)
			.update();
		Map<String, String> answer = consent(session, "mcp.research", "mcp.research");
		String tokens = token("grant_type=authorization_code&client_id=cursor&code=" + answer.get("code")
				+ "&redirect_uri=" + REDIRECT + "&code_verifier=" + VERIFIER);

		jdbc.sql("update identity_account set platform_role = 'user' where email = :email")
			.param("email", email)
			.update();

		client.post()
			.uri("/oauth2/token")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body("grant_type=refresh_token&client_id=cursor&refresh_token="
					+ JsonPath.read(tokens, "$.refresh_token"))
			.exchange()
			.expectStatus()
			.isBadRequest()
			.expectBody()
			.jsonPath("$.error")
			.isEqualTo("invalid_grant");
	}

	@Test
	void anOperatorGetsATokenForTheOperatorServer() {
		String session = TestSignIn.session(client, mail, "Operator@genaifund.test");

		Map<String, String> answer = consent(session, "mcp.research", "mcp.research");
		String tokens = token("grant_type=authorization_code&client_id=cursor&code=" + answer.get("code")
				+ "&redirect_uri=" + REDIRECT + "&code_verifier=" + VERIFIER);

		assertThat(audienceOf(JsonPath.read(tokens, "$.access_token"))).isEqualTo(ISSUER + "/mcp/operator");
	}

	@Test
	void aClientWhoseDocumentCannotBeReadIsRefused() {
		String session = TestSignIn.session(client, mail, "minh.mcp@example.test");

		client.get()
			.uri("/oauth2/authorize?response_type=code&client_id=https://attacker.example/client.json&scope=mcp.read"
					+ "&redirect_uri=https://attacker.example/cb&code_challenge=" + challenge()
					+ "&code_challenge_method=S256&state=s")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isBadRequest();
	}

	@Test
	void aRedirectToAnotherHostIsRefused() {
		String session = TestSignIn.session(client, mail, "ha.mcp@example.test");

		client.get()
			.uri("/oauth2/authorize?response_type=code&client_id=cursor&scope=mcp.read"
					+ "&redirect_uri=http://evil.example:8787/callback&code_challenge=" + challenge()
					+ "&code_challenge_method=S256&state=s")
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isBadRequest();
	}

	@Test
	void everyConnectionAsksThePersonAgain() {
		String session = TestSignIn.session(client, mail, "vy.mcp@example.test");

		consent(session, "mcp.read", "mcp.read");

		stateOfConsentPage(session, "cursor", REDIRECT, "mcp.read");
	}

	@Test
	void anAgentOnThisComputerConnectsThroughTheSharedClientOnAnyPortAndPath() {
		String session = TestSignIn.session(client, mail, "son.mcp@example.test");
		String redirect = "http://127.0.0.1:61234/oauth/cb";

		Map<String, String> answer = consent(session, "mcp-local", redirect, "mcp.read", "mcp.read");
		String tokens = token("grant_type=authorization_code&client_id=mcp-local&code=" + answer.get("code")
				+ "&redirect_uri=" + redirect + "&code_verifier=" + VERIFIER);

		assertThat(audienceOf(JsonPath.read(tokens, "$.access_token"))).isEqualTo(ISSUER + "/mcp");
		client.get()
			.uri(authorizeBuilder("mcp-local", "https://attacker.example/cb", "mcp.read").build().toUri())
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isBadRequest();
	}

	@Test
	void theConsentPageLearnsWhereTheAnswerGoesForItsOwnRequestOnly() {
		String session = TestSignIn.session(client, mail, "nga.mcp@example.test");
		String state = stateOfConsentPage(session, "mcp-local", "http://127.0.0.1:61234/cb", "mcp.read");

		client.get()
			.uri("/api/identity/apps/connecting?clientId={client}&state={state}", "mcp-local", state)
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.name")
			.isEqualTo("An app on this computer")
			.jsonPath("$.local")
			.isEqualTo(true)
			.jsonPath("$.anyLocalApp")
			.isEqualTo(true)
			.jsonPath("$.reviewed")
			.isEqualTo(false)
			.jsonPath("$.host")
			.isEmpty()
			.jsonPath("$.returnsTo")
			.isEmpty();

		String someoneElse = TestSignIn.session(client, mail, "khanh.mcp@example.test");
		client.get()
			.uri("/api/identity/apps/connecting?clientId={client}&state={state}", "mcp-local", state)
			.cookie(TestSignIn.SESSION_COOKIE, someoneElse)
			.exchange()
			.expectStatus()
			.isNotFound();
	}

	@Test
	void anErrorBeforeThePersonAnswersIsShownNotRedirectedForAnAppNotReviewed() {
		String clientId = "https://unreviewed.example/client.json";
		clients.save(RegisteredClient.withId(UUID.randomUUID().toString())
			.clientId(clientId)
			.clientName("Claude")
			.clientAuthenticationMethod(ClientAuthenticationMethod.NONE)
			.authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
			.redirectUri("https://unreviewed.example/cb")
			.scope("mcp.read")
			.clientSettings(ClientSettings.builder()
				.requireProofKey(true)
				.setting("beyondpilot.document-fresh-until", Instant.now().plus(Duration.ofHours(1)).toString())
				.build())
			.build());
		String session = TestSignIn.session(client, mail, "phuc.mcp@example.test");

		client.get()
			.uri(authorizeBuilder(clientId, "https://unreviewed.example/cb", "no.such.scope").build().toUri())
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.isBadRequest();
	}

	@Test
	void theMetadataAdvertisesWhatAppsNeed() {
		client.get()
			.uri("/.well-known/oauth-authorization-server")
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody()
			.jsonPath("$.issuer")
			.isEqualTo(ISSUER)
			.jsonPath("$.client_id_metadata_document_supported")
			.isEqualTo(true)
			.jsonPath("$.authorization_response_iss_parameter_supported")
			.isEqualTo(true)
			.jsonPath("$.code_challenge_methods_supported[0]")
			.isEqualTo("S256")
			.jsonPath("$.registration_endpoint")
			.doesNotExist();
	}

	/** Asks for a code, consents to {@code granted}, and returns the parameters the app receives. */
	private Map<String, String> consent(String session, String requested, String granted) {
		return consent(session, "cursor", REDIRECT, requested, granted);
	}

	/** Asks for a code as {@code clientId}, consents to {@code granted}, and returns what the app receives. */
	private Map<String, String> consent(String session, String clientId, String redirect, String requested,
			String granted) {
		String state = stateOfConsentPage(session, clientId, redirect, requested);

		StringBuilder form = new StringBuilder(
				"client_id=" + clientId + "&state=" + java.net.URLEncoder.encode(state, StandardCharsets.UTF_8));
		for (String scope : granted.split(" ")) {
			form.append("&scope=").append(scope);
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
		assertThat(back.toString()).startsWith(redirect + "?");
		return UriComponentsBuilder.fromUri(back).build(true).getQueryParams().toSingleValueMap().entrySet().stream()
			.collect(java.util.stream.Collectors.toMap(Map.Entry::getKey,
					entry -> java.net.URLDecoder.decode(entry.getValue(), StandardCharsets.UTF_8)));
	}

	/** Asks for a code and returns the state the consent page is opened with. */
	private String stateOfConsentPage(String session, String clientId, String redirect, String scope) {
		URI consentPage = client.get()
			.uri(authorizeBuilder(clientId, redirect, scope).build().toUri())
			.cookie(TestSignIn.SESSION_COOKIE, session)
			.exchange()
			.expectStatus()
			.is3xxRedirection()
			.returnResult()
			.getResponseHeaders()
			.getLocation();
		assertThat(consentPage.toString()).contains("/oauth-consent?");
		return java.net.URLDecoder.decode(
				UriComponentsBuilder.fromUri(consentPage).build().getQueryParams().getFirst("state"), StandardCharsets.UTF_8);
	}

	private String token(String form) {
		return client.post()
			.uri("/oauth2/token")
			.contentType(MediaType.APPLICATION_FORM_URLENCODED)
			.body(form)
			.exchange()
			.expectStatus()
			.isOk()
			.expectBody(String.class)
			.returnResult()
			.getResponseBody();
	}

	private URI authorize(String scope) {
		return authorizeBuilder(scope).build().toUri();
	}

	private URI authorize(String scope, String resource) {
		return authorizeBuilder(scope).queryParam("resource", resource).encode().build().toUri();
	}

	private UriComponentsBuilder authorizeBuilder(String scope) {
		return authorizeBuilder("cursor", REDIRECT, scope);
	}

	private UriComponentsBuilder authorizeBuilder(String clientId, String redirect, String scope) {
		return UriComponentsBuilder.fromUriString("http://localhost:" + port + "/oauth2/authorize")
			.queryParam("response_type", "code")
			.queryParam("client_id", clientId)
			.queryParam("scope", scope)
			.queryParam("redirect_uri", redirect)
			.queryParam("code_challenge", challenge())
			.queryParam("code_challenge_method", "S256")
			.queryParam("state", "state-1")
			.encode();
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

	private static String audienceOf(String jwt) {
		String claims = new String(Base64.getUrlDecoder().decode(jwt.split("\\.")[1]), StandardCharsets.UTF_8);
		Object audience = JsonPath.read(claims, "$.aud");
		return audience instanceof java.util.List<?> list ? String.valueOf(list.getFirst()) : String.valueOf(audience);
	}

}
